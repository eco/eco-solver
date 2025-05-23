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
import { Chain, getAddress, zeroAddress } from 'viem'
import { addressKeys, getRpcUrl } from '@/common/viem/utils'
import { ChainsSupported } from '@/common/chains/supported'
import { getChainConfig } from './utils'

/**
 * Service class for getting configs for the app
 */
@Injectable()
export class EcoConfigService {
  private logger = new Logger(EcoConfigService.name)
  private externalConfigs: any = {}
  private ecoConfig: config.IConfig

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
  }

  // Generic getter for key/val of config object
  get<T>(key: string): T {
    return this.ecoConfig.get<T>(key)
  }

  // Returns the alchemy configs
  getAlchemy(): EcoConfigType['alchemy'] {
    return this.get('alchemy')
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

  // Returns the liquidity manager config
  getLiquidityManager(): EcoConfigType['liquidityManager'] {
    return this.get('liquidityManager')
  }

  // Returns the liquidity manager config
  getWhitelist(): EcoConfigType['whitelist'] {
    return this.get('whitelist')
  }

  // Returns the liquidity manager config
  getHyperlane(): EcoConfigType['hyperlane'] {
    return this.get('hyperlane')
  }

  // Returns the liquidity manager config
  getWithdraws(): EcoConfigType['withdraws'] {
    return this.get('withdraws')
  }

  // Returns the liquidity manager config
  getSendBatch(): EcoConfigType['sendBatch'] {
    return this.get('sendBatch')
  }

  // Returns the liquidity manager config
  getIndexer(): EcoConfigType['indexer'] {
    return this.get('indexer')
  }

  // Returns the liquidity manager config
  getCCTP(): EcoConfigType['CCTP'] {
    return this.get('CCTP')
  }

  // Returns the liquidity manager config
  getCrowdLiquidity(): EcoConfigType['crowdLiquidity'] {
    return this.get('crowdLiquidity')
  }

  // Returns the liquidity manager config
  getWarpRoutes(): EcoConfigType['warpRoutes'] {
    return this.get('warpRoutes')
  }

  getRpcUrls(): EcoConfigType['rpcUrls'] {
    return this.get('rpcUrls')
  }

  getChainRPCs() {
    const entries = ChainsSupported.map((chain) => [chain.id, this.getRpcUrl(chain).url])
    return Object.fromEntries(entries) as Record<number, string>
  }

  getRpcUrl(chain: Chain, websocketEnabled?: boolean) {
    const alchemy = this.getAlchemy()
    const rpcUrls = this.getRpcUrls()[chain.id.toString()]
    const options = { alchemyApiKey: alchemy.apiKey, rpcUrls, websocketEnabled }
    return getRpcUrl(chain, options)
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
}
