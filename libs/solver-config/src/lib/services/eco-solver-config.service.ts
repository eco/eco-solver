import { Injectable, Logger } from '@nestjs/common'
import { ConfigSource } from '../interfaces/config-source.interface'
import {
  EcoSolverConfigSchema,
  type EcoSolverConfigType,
  Solver,
  IntentSource,
  EcoSolverDatabaseConfig,
  RpcConfig,
} from '../schemas/eco-solver.schema'
import { type Hex } from 'viem'
import { merge } from 'lodash'
import { getChainConfig } from '../utils/chain-config.utils'
import { EcoChainConfig } from '@eco-foundation/routes-ts'
import { getAddress, zeroAddress } from 'viem'

@Injectable()
export class EcoSolverConfigService {
  private readonly logger = new Logger(EcoSolverConfigService.name)
  private mergedConfig!: EcoSolverConfigType
  private initialized = false

  constructor(private readonly configSources: ConfigSource[]) {
    // Service doesn't know about specific providers - just works with ConfigSource[]
    this.logger.log(
      `Initialized with ${configSources.length} config sources: ${configSources
        .map((s) => s.name)
        .join(', ')}`,
    )
  }

  async initializeConfig(): Promise<void> {
    if (this.initialized) return

    this.logger.log('Loading configuration from all sources...')

    // Use Promise.allSettled to handle failures gracefully
    const results = await Promise.allSettled(
      this.configSources
        .filter((source) => source.enabled)
        .map(async (source) => ({
          name: source.name,
          priority: source.priority,
          config: await source.getConfig(),
        })),
    )

    // Process results
    const configs = results
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<{
          name: string
          priority: number
          config: Record<string, unknown>
        }> => {
          if (result.status === 'rejected') {
            this.logger.warn(`Config source failed: ${result.reason.message}`)
            return false
          }
          return true
        },
      )
      .map((result) => result.value)
      .sort((a, b) => b.priority - a.priority) // Sort by priority (highest first)

    this.logger.log(`Successfully loaded configs from: ${configs.map((c) => c.name).join(', ')}`)

    // Merge configs in priority order (last wins in lodash merge)
    const mergedRawConfig = configs.reduce((acc, { config }) => merge(acc, config), {})

    // Validate merged config with Zod schema
    try {
      this.mergedConfig = EcoSolverConfigSchema.parse(mergedRawConfig)
      this.initialized = true
      this.logger.log('Configuration validation successful')
    } catch (error) {
      this.logger.error('Configuration validation failed:', error)
      throw new Error(
        `Invalid eco-solver configuration: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }

  // Generic getter for config values
  get<T>(key: string): T {
    this.ensureInitialized()
    return this.mergedConfig[key as keyof EcoSolverConfigType] as T
  }

  // Returns the RPC configs
  getRpcConfig(): EcoSolverConfigType['rpcs'] {
    this.ensureInitialized()
    return this.mergedConfig.rpcs
  }

  // Returns the AWS configs
  getAwsConfigs(): EcoSolverConfigType['aws'] {
    this.ensureInitialized()
    return this.mergedConfig.aws
  }

  // Returns the cache configs
  getCache(): EcoSolverConfigType['cache'] {
    this.ensureInitialized()
    return this.mergedConfig.cache
  }

  // Returns the server config
  getServer(): EcoSolverConfigType['server'] {
    this.ensureInitialized()
    return this.mergedConfig.server
  }

  // Returns the database config
  getDatabaseConfig(): EcoSolverDatabaseConfig | undefined {
    this.ensureInitialized()
    return this.mergedConfig.database
  }

  // Returns the Redis configs
  getRedisConfig(): EcoSolverConfigType['redis'] {
    this.ensureInitialized()
    return this.mergedConfig.redis
  }

  // Returns the solvers config with chain-specific transformations
  getSolvers(): Record<number, Solver> {
    this.ensureInitialized()
    const solvers = this.mergedConfig.solvers || {}

    // Apply chain config transformations (existing business logic)
    return Object.fromEntries(
      Object.entries(solvers).map(([chainId, solver]) => {
        const config = getChainConfig(parseInt(chainId))
        return [
          chainId,
          {
            ...solver,
            inboxAddress: config.Inbox,
            targets: this.addressKeys(solver.targets) ?? {},
          },
        ]
      }),
    )
  }

  // Returns the solver for a specific chain or undefined if its not supported
  getSolver(chainID: number | bigint): Solver | undefined {
    const id = typeof chainID === 'bigint' ? Number(chainID) : chainID
    return this.getSolvers()[id]
  }

  // Returns the intent sources with chain-specific transformations
  getIntentSources(): IntentSource[] {
    this.ensureInitialized()
    const intentSources = this.mergedConfig.intentSources || []

    return intentSources.map((intent: IntentSource) => {
      const config = getChainConfig(intent.chainID)
      return {
        ...intent,
        sourceAddress: config.IntentSource as Hex,
        inbox: config.Inbox as Hex,
        // Apply existing business logic transformations
        provers: this.processProvers(intent, config),
        tokens: intent.tokens.map((token: string) => getAddress(token) as Hex),
      }
    })
  }

  // Returns the intent source for a specific chain or undefined if its not supported
  getIntentSource(chainID: number): IntentSource | undefined {
    return this.getIntentSources().find((intent) => intent.chainID === chainID)
  }

  // Returns the intervals config
  getIntervals(): EcoSolverConfigType['intervals'] {
    this.ensureInitialized()
    return this.mergedConfig.intervals
  }

  // Returns the intent configs
  getIntentConfigs(): EcoSolverConfigType['intentConfigs'] {
    this.ensureInitialized()
    return this.mergedConfig.intentConfigs
  }

  // Returns the quotes config
  getQuotesConfig(): EcoSolverConfigType['quotesConfig'] {
    this.ensureInitialized()
    return this.mergedConfig.quotesConfig
  }

  // Returns the gasless intent app IDs
  getGaslessIntentdAppIDs(): string[] {
    this.ensureInitialized()
    return this.mergedConfig.gaslessIntentdAppIDs || []
  }

  // Returns the whitelist config
  getWhitelist(): EcoSolverConfigType['whitelist'] {
    this.ensureInitialized()
    return this.mergedConfig.whitelist
  }

  // Returns the crowd liquidity config
  getCrowdLiquidity(): EcoSolverConfigType['crowdLiquidity'] {
    this.ensureInitialized()
    return this.mergedConfig.crowdLiquidity || {}
  }

  // Returns the fulfillment estimate config
  getFulfillmentEstimate(): EcoSolverConfigType['fulfillmentEstimate'] {
    this.ensureInitialized()
    return this.mergedConfig.fulfillmentEstimate
  }

  // Returns the gas estimations config
  getGasEstimations(): EcoSolverConfigType['gasEstimations'] {
    this.ensureInitialized()
    return this.mergedConfig.gasEstimations
  }

  // Returns the indexer config
  getIndexer(): EcoSolverConfigType['indexer'] {
    this.ensureInitialized()
    return this.mergedConfig.indexer
  }

  // Returns the withdraws config
  getWithdraws(): EcoSolverConfigType['withdraws'] {
    this.ensureInitialized()
    return this.mergedConfig.withdraws
  }

  // Returns the send batch config
  getSendBatch(): EcoSolverConfigType['sendBatch'] {
    this.ensureInitialized()
    return this.mergedConfig.sendBatch
  }

  // Returns the CCTP config
  getCCTP(): EcoSolverConfigType['CCTP'] {
    this.ensureInitialized()
    return this.mergedConfig.CCTP
  }

  // Returns the CCTP V2 config
  getCCTPV2(): EcoSolverConfigType['CCTPV2'] {
    this.ensureInitialized()
    return this.mergedConfig.CCTPV2
  }

  // Returns the CCTP LiFi config
  getCCTPLiFiConfig(): EcoSolverConfigType['CCTPLiFi'] {
    this.ensureInitialized()
    return this.mergedConfig.CCTPLiFi
  }

  // Returns the Hyperlane config
  getHyperlane(): EcoSolverConfigType['hyperlane'] {
    this.ensureInitialized()
    return this.mergedConfig.hyperlane
  }

  // Returns external APIs config
  getExternalAPIs(): EcoSolverConfigType['externalAPIs'] {
    this.ensureInitialized()
    return this.mergedConfig.externalAPIs
  }

  // Returns the Squid config
  getSquid(): EcoSolverConfigType['squid'] {
    this.ensureInitialized()
    return this.mergedConfig.squid
  }

  // Returns the Everclear config
  getEverclear(): EcoSolverConfigType['everclear'] {
    this.ensureInitialized()
    return this.mergedConfig.everclear
  }

  // Returns the solver registration config
  getSolverRegistrationConfig(): EcoSolverConfigType['solverRegistrationConfig'] {
    this.ensureInitialized()
    return this.mergedConfig.solverRegistrationConfig
  }

  // Returns the fulfill config
  getFulfill(): EcoSolverConfigType['fulfill'] {
    this.ensureInitialized()
    return this.mergedConfig.fulfill
  }

  // Returns the KMS config
  getKmsConfig(): EcoSolverConfigType['kms'] {
    this.ensureInitialized()
    return this.mergedConfig.kms
  }

  // Returns the Safe config
  getSafe(): EcoSolverConfigType['safe'] {
    this.ensureInitialized()
    return this.mergedConfig.safe
  }

  // Returns the LaunchDarkly config
  getLaunchDarkly(): EcoSolverConfigType['launchDarkly'] {
    this.ensureInitialized()
    return this.mergedConfig.launchDarkly
  }

  // Returns the analytics config
  getAnalyticsConfig(): EcoSolverConfigType['analytics'] {
    this.ensureInitialized()
    return this.mergedConfig.analytics
  }

  // Alias for getRedisConfig for backward compatibility
  getRedis(): EcoSolverConfigType['redis'] {
    return this.getRedisConfig()
  }

  // Returns supported chain IDs
  getSupportedChains(): number[] {
    this.ensureInitialized()
    return Object.keys(this.mergedConfig.solvers || {}).map(Number)
  }

  // Returns liquidity manager config
  getLiquidityManager(): EcoSolverConfigType['liquidityManager'] {
    this.ensureInitialized()
    return this.mergedConfig.liquidityManager
  }

  // Alias for getGasEstimations for backward compatibility
  getGasEstimationsConfig(): EcoSolverConfigType['gasEstimations'] {
    return this.getGasEstimations()
  }

  // Alias for getFulfillmentEstimate for backward compatibility
  getFulfillmentEstimateConfig(): EcoSolverConfigType['fulfillmentEstimate'] {
    return this.getFulfillmentEstimate()
  }

  // Returns RPC URLs for a chain
  getRpcUrls(chainId: number): { rpcUrls: string[]; config: RpcConfig } {
    this.ensureInitialized()
    const rpcs = this.mergedConfig.rpcs || {}
    const chainRpcs = rpcs[chainId] || []
    return {
      rpcUrls: chainRpcs.map((rpc: string | { url: string }) =>
        typeof rpc === 'string' ? rpc : rpc.url,
      ),
      config: rpcs,
    }
  }

  // Returns chain RPCs mapping for LiFi SDK
  getChainRpcs(): Record<string, string> {
    this.ensureInitialized()
    const rpcs = this.mergedConfig.rpcs || {}
    const chainRpcs: Record<string, string> = {}

    for (const chainId in rpcs.keys || {}) {
      const rpcUrls = rpcs.keys[chainId]
      if (rpcUrls && typeof rpcUrls === 'string') {
        chainRpcs[chainId] = rpcUrls
      }
    }

    return chainRpcs
  }

  // Static method for backward compatibility
  static getStaticConfig(): EcoSolverConfigType {
    // This is a legacy compatibility method - in production, use the service instance
    const { getStaticSolverConfig } = require('../solver-config')
    return getStaticSolverConfig()
  }

  // Returns the ETH config
  getEth(): EcoSolverConfigType['eth'] {
    this.ensureInitialized()
    return this.mergedConfig.eth
  }

  // Legacy compatibility method - constructs MongoDB URI
  getMongooseUri(): string {
    this.ensureInitialized()
    const config = this.mergedConfig.database
    if (!config) {
      throw new Error('Database configuration is not available')
    }
    return config.auth.enabled
      ? `${config.uriPrefix}${config.auth.username}:${config.auth.password}@${config.uri}/${config.dbName}`
      : `${config.uriPrefix}${config.uri}/${config.dbName}`
  }

  // Legacy compatibility method - returns logger config
  getLoggerConfig(): EcoSolverConfigType['logger'] {
    this.ensureInitialized()
    return this.mergedConfig.logger
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('EcoSolverConfigService not initialized. Call initializeConfig() first.')
    }
  }

  // Debug method for development
  getDebugInfo() {
    return {
      initialized: this.initialized,
      sourcesCount: this.configSources.length,
      sources: this.configSources.map((s) => ({
        name: s.name,
        priority: s.priority,
        enabled: s.enabled,
      })),
    }
  }

  private processProvers(intent: IntentSource, config: EcoChainConfig): Hex[] {
    // Existing prover processing logic from EcoConfigService
    const ecoNpm = intent.config?.ecoRoutes || 'append'
    const ecoNpmProvers = [config.HyperProver, config.MetaProver].filter(
      (prover) => getAddress(prover) !== zeroAddress,
    ) as Hex[]

    switch (ecoNpm) {
      case 'replace':
        return ecoNpmProvers
      case 'append':
      default:
        return [...(intent.provers || []), ...ecoNpmProvers]
    }
  }

  // Helper method to convert address keys (replicated from existing utils)
  private addressKeys(targets: Record<string, unknown> = {}): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    Object.entries(targets).forEach(([key, value]) => {
      try {
        const checksummedKey = getAddress(key)
        result[checksummedKey] = value
      } catch {
        // Keep original key if not a valid address
        result[key] = value
      }
    })

    return result
  }

  // Additional missing methods from the eco-config service
  getWarpRoutes(): EcoSolverConfigType['warpRoutes'] {
    this.ensureInitialized()
    return this.mergedConfig.warpRoutes
  }

  getLiFi(): EcoSolverConfigType['liFi'] {
    this.ensureInitialized()
    return this.mergedConfig.liFi
  }
}
