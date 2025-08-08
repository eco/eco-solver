import { Injectable, Logger } from '@nestjs/common'
import * as _ from 'lodash'
import * as config from 'config'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { ConfigSource } from './interfaces/config-source.interface'
import {
  AwsCredential,
  EcoConfigType,
  IntentSource,
  KmsConfig,
  ProverEcoRoutesProverAppend,
  SafeType,
  Solver,
} from './eco-config.types'
import { Chain, getAddress, Hex, zeroAddress } from 'viem'
import { addressKeys } from '@/common/viem/utils'
import { ChainsSupported } from '@/common/chains/supported'
import { getChainConfig, recursiveConfigNormalizer } from './utils'
import { EcoChains } from '@eco-foundation/chains'
import { EcoError } from '@/common/errors/eco-error'
import { TransportConfig } from '@/common/chains/transport'

/**
 * Service class for managing application configuration from multiple sources.
 *
 * Configuration hierarchy and merging strategy:
 * 1. External configs (injected via ConfigSource providers) - lowest priority
 * 2. Static configs from config package (from /config directory) - medium priority
 * 3. Environment variables and runtime configs - highest priority
 *
 * The EcoConfigService works with the following sources:
 * - Static JSON/TS configs in the config/ directory
 * - External configs injected via ConfigSource providers (e.g. AWS secrets)
 * - EcoChains package for blockchain RPC configuration
 *
 * The EcoChains integration:
 * - EcoChains is initialized with RPC API keys from the config
 * - Provides chain-specific configurations including RPC URLs
 * - Handles custom endpoints (Caldera/Alchemy) vs default endpoints
 * - Manages both HTTP and WebSocket connections
 *
 * Config values are merged using deep extend, with latter sources overriding
 * earlier ones when conflicts exist, while preserving non-conflicting values.
 */
@Injectable()
export class EcoConfigService {
  private logger = new Logger(EcoConfigService.name)
  private externalConfigs: any = {}
  private ecoConfig: config.IConfig
  private ecoChains: EcoChains

  constructor(private readonly sources: ConfigSource[]) {
    this.sources.reduce((prev, curr) => {
      return config.util.extendDeep(prev, curr.getConfig())
    }, this.externalConfigs)

    this.ecoConfig = config
    this.initConfigs()
  }

  /**
   * Returns the static configs  for the app, from the 'config' package
   * @returns the configs
   */
  static getStaticConfig(): EcoConfigType {
    return config as unknown as EcoConfigType
  }

  async onModuleInit() {}

  // Initialize the configs
  initConfigs() {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `Initializing eco configs`,
      }),
    )

    // Merge the secrets with the existing config, the external configs will be overwritten by the internal ones
    this.ecoConfig = config.util.extendDeep(this.externalConfigs, this.ecoConfig)

    // Apply recursive config normalization to avoid default import config values
    this.ecoConfig = recursiveConfigNormalizer(this.ecoConfig)

    // Set the eco chain rpc token api keys
    this.ecoChains = new EcoChains(this.getRpcConfig().keys)
  }

  // Generic getter for key/val of config object
  get<T>(key: string): T {
    return this.ecoConfig.get<T>(key)
  }

  // Returns the alchemy configs
  getRpcConfig(): EcoConfigType['rpcs'] {
    return this.get('rpcs')
  }

  // Returns the aws configs
  getAwsConfigs(): AwsCredential[] {
    return this.get('aws')
  }

  // Returns the cache configs
  getCache(): EcoConfigType['cache'] {
    return this.get('cache')
  }

  // Returns the fulfill configs
  getFulfill(): EcoConfigType['fulfill'] {
    return this.get('fulfillment')
  }

  getGaslessIntentdAppIDs(): string[] {
    const gaslessIntentdAppIDs = this.get<string[]>('gaslessIntentdAppIDs') || []
    return gaslessIntentdAppIDs
  }

  // Returns the source intents config
  getIntentSources(): EcoConfigType['intentSources'] {
    return this.get<IntentSource[]>('intentSources').map((intent: IntentSource) => {
      const config = getChainConfig(intent.chainID)
      intent.sourceAddress = config.IntentSource
      intent.inbox = config.Inbox
      const ecoNpm = intent.config ? intent.config.ecoRoutes : ProverEcoRoutesProverAppend
      const ecoNpmProvers = [config.HyperProver, config.MetaProver].filter(
        (prover) => getAddress(prover) !== zeroAddress,
      )
      switch (ecoNpm) {
        case 'replace':
          intent.provers = ecoNpmProvers
          break
        case 'append':
        default:
          intent.provers = [...(intent.provers || []), ...ecoNpmProvers]
          break
      }
      //remove duplicates
      intent.provers = _.uniq(intent.provers)

      intent.tokens = intent.tokens.map((token: string) => getAddress(token))
      return intent
    })
  }

  // Returns the intent source for a specific chain or undefined if its not supported
  getIntentSource(chainID: number): IntentSource | undefined {
    return this.getIntentSources().find((intent) => intent.chainID === chainID)
  }

  // Returns the aws configs
  getKmsConfig(): KmsConfig {
    return this.get('kms')
  }

  // Returns the safe multisig configs
  getSafe(): SafeType {
    const safe = this.get<SafeType>('safe')
    if (safe.owner) {
      // validate and checksum the owner address, throws if invalid/not-set
      safe.owner = getAddress(safe.owner)
    }
    return safe
  }

  // Returns the solvers config
  getSolvers(): EcoConfigType['solvers'] {
    const solvers = this.get<Record<number, Solver>>('solvers')
    _.entries(solvers).forEach(([, solver]: [string, Solver]) => {
      const config = getChainConfig(solver.chainID)
      solver.inboxAddress = config.Inbox
      solver.targets = addressKeys(solver.targets) ?? {}
    })
    return solvers
  }

  // Returns the solver for a specific chain or undefined if its not supported
  getSolver(chainID: number | bigint): Solver | undefined {
    chainID = typeof chainID === 'bigint' ? Number(chainID) : chainID
    return this.getSolvers()[chainID]
  }

  // Get the launch darkly configs
  getLaunchDarkly(): EcoConfigType['launchDarkly'] {
    return this.get('launchDarkly')
  }

  getAnalyticsConfig(): EcoConfigType['analytics'] {
    return this.get('analytics')
  }

  getDatabaseConfig(): EcoConfigType['database'] {
    return this.get('database')
  }

  // Returns the eth configs
  getEth(): EcoConfigType['eth'] {
    return this.get('eth')
  }

  // Returns the intervals config, sets defaults for repeatOpts and jobTemplate if not set
  getIntervals(): EcoConfigType['intervals'] {
    const configs = this.get('intervals') as EcoConfigType['intervals']
    for (const [, value] of Object.entries(configs)) {
      _.merge(value, configs.defaults, value)
    }
    return configs
  }

  // Returns the intent configs
  getIntentConfigs(): EcoConfigType['intentConfigs'] {
    return this.get('intentConfigs')
  }

  // Returns the quote configs
  getQuotesConfig(): EcoConfigType['quotesConfig'] {
    return this.get('quotesConfig')
  }

  // Returns the solver registration config
  getSolverRegistrationConfig(): EcoConfigType['solverRegistrationConfig'] {
    return this.get('solverRegistrationConfig')
  }

  // Returns the external APIs config
  getExternalAPIs(): EcoConfigType['externalAPIs'] {
    return this.get('externalAPIs')
  }

  getLoggerConfig(): EcoConfigType['logger'] {
    return this.get('logger')
  }

  getMongooseUri() {
    const config = this.getDatabaseConfig()
    return config.auth.enabled
      ? `${config.uriPrefix}${config.auth.username}:${config.auth.password}@${config.uri}/${config.dbName}`
      : `${config.uriPrefix}${config.uri}/${config.dbName}`
  }

  // Returns the redis configs
  getRedis(): EcoConfigType['redis'] {
    return this.get('redis')
  }

  // Returns the server configs
  getServer(): EcoConfigType['server'] {
    return this.get('server')
  }

  getGasEstimationsConfig(): EcoConfigType['gasEstimations'] {
    return this.get('gasEstimations')
  }

  // Returns the liquidity manager config
  getLiquidityManager(): EcoConfigType['liquidityManager'] {
    return this.get('liquidityManager')
  }

  getWhitelist(): EcoConfigType['whitelist'] {
    return this.get('whitelist')
  }

  getHyperlane(): EcoConfigType['hyperlane'] {
    return this.get('hyperlane')
  }

  getWithdraws(): EcoConfigType['withdraws'] {
    return this.get('withdraws')
  }

  getSendBatch(): EcoConfigType['sendBatch'] {
    return this.get('sendBatch')
  }

  getIndexer(): EcoConfigType['indexer'] {
    return this.get('indexer')
  }

  getCCTP(): EcoConfigType['CCTP'] {
    return this.get('CCTP')
  }

  getCCTPV2(): EcoConfigType['CCTPV2'] {
    return this.get('CCTPV2')
  }

  getCrowdLiquidity(): EcoConfigType['crowdLiquidity'] {
    return this.get('crowdLiquidity')
  }

  getWarpRoutes(): EcoConfigType['warpRoutes'] {
    return this.get('warpRoutes')
  }

  getLiFi(): EcoConfigType['liFi'] {
    return this.get('liFi')
  }

  getSquid(): EcoConfigType['squid'] {
    return this.get('squid')
  }

  // Returns the liquidity manager config
  getChainRpcs(): Record<number, string[]> {
    const entries = ChainsSupported.map(
      (chain) => [chain.id, this.getRpcUrls(chain).rpcUrls] as const,
    )
    return Object.fromEntries(entries)
  }

  getCustomRPCUrl(chainID: string) {
    return this.getRpcConfig().custom?.[chainID]
  }

  /**
   * Returns the RPC URL for a given chain, prioritizing custom endpoints (like Caldera or Alchemy)
   * over default ones when available. For WebSocket connections, returns WebSocket URLs when available.
   * @param chain The chain object to get the RPC URL for
   * @returns The RPC URL string for the specified chain
   */
  getRpcUrls(chain: Chain): { rpcUrls: string[]; config: TransportConfig } {
    let { webSockets: isWebSocketEnabled = true } = this.getRpcConfig().config

    const rpcChain = this.ecoChains.getChain(chain.id)
    const custom = rpcChain.rpcUrls.custom
    const def = rpcChain.rpcUrls.default

    const customRpcUrls = this.getCustomRPCUrl(chain.id.toString())

    let rpcs: string[] = []
    if (isWebSocketEnabled) {
      rpcs = [...(custom?.webSocket || def?.webSocket || [])]
    } else {
      rpcs = [...(custom?.http || def?.http || [])]
    }

    const config: TransportConfig['config'] = customRpcUrls?.config

    if (customRpcUrls?.http) {
      isWebSocketEnabled = Boolean(customRpcUrls.webSocket?.length)
      rpcs = isWebSocketEnabled ? customRpcUrls.webSocket || [] : customRpcUrls.http || []
    }

    if (!rpcs.length) {
      throw EcoError.ChainRPCNotFound(chain.id)
    }

    return { rpcUrls: rpcs, config: { isWebsocket: isWebSocketEnabled, config } }
  }

  /**
   * Checks to see what networks we have inbox contracts for
   * @returns the supported chains for the event
   */
  getSupportedChains(): bigint[] {
    return _.entries(this.getSolvers()).map(([, solver]) => BigInt(solver.chainID))
  }

  /**
   * Returns the fulfillment estimate config
   * @returns the fulfillment estimate config
   */
  getFulfillmentEstimateConfig(): EcoConfigType['fulfillmentEstimate'] {
    return this.get('fulfillmentEstimate')
  }

  getCCTPLiFiConfig(): EcoConfigType['cctpLiFi'] {
    const liquidityManager = this.getLiquidityManager()
    const cctp = this.getCCTP()
    return {
      maxSlippage: liquidityManager.maxQuoteSlippage,
      usdcAddresses: cctp.chains.reduce(
        (acc, chain) => {
          acc[chain.chainId] = getAddress(chain.token)
          return acc
        },
        {} as Record<number, Hex>,
      ),
    }
  }
}
