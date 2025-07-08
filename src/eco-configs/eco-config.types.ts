import { Network } from '@/common/alchemy/network'
import { ClusterNode } from 'ioredis'
import { Params as PinoParams } from 'nestjs-pino'
import * as Redis from 'ioredis'
import { Settings } from 'redlock'
import { JobsOptions, RepeatOptions } from 'bullmq'
import { Hex, HttpTransportConfig, WebSocketTransportConfig } from 'viem'
import { LDOptions } from '@launchdarkly/node-server-sdk'
import { CacheModuleOptions } from '@nestjs/cache-manager'
import { LIT_NETWORKS_KEYS } from '@lit-protocol/types'
import { IntentExecutionTypeKeys } from '@/quote/enums/intent-execution-type.enum'
import { ConfigRegex } from '@eco-foundation/chains'
import { Strategy } from '@/liquidity-manager/types/types'

// The config type that we store in json
export type EcoConfigType = {
  server: ServerConfig
  gasEstimations: GasEstimationsConfig
  safe: SafeType
  externalAPIs: unknown
  redis: RedisConfig
  intervals: IntervalConfig
  quotesConfig: QuotesConfig
  solverRegistrationConfig: SolverRegistrationConfig
  intentConfigs: IntentConfig
  fulfillmentEstimate: FulfillmentEstimateConfig
  rpcs: RpcConfigType
  cache: CacheModuleOptions
  launchDarkly: LaunchDarklyConfig
  eth: {
    privateKey: string
    simpleAccount: {
      walletAddr: Hex
      signerPrivateKey: Hex
      minEthBalanceWei: number
      contracts: {
        entryPoint: {
          contractAddress: Hex
        }
        paymaster: {
          contractAddresses: Hex[]
        }
        simpleAccountFactory: {
          contractAddress: Hex
        }
      }
    }
    claimant: Hex
    nonce: {
      update_interval_ms: number
    }
    pollingInterval: number
  }
  fulfill: FulfillType
  aws: AwsCredential[]
  kms: KmsConfig
  whitelist: WhitelistFeeRecord
  database: {
    auth: MongoAuthType
    uriPrefix: string
    uri: string
    dbName: string
    enableJournaling: boolean
  }
  intentSources: IntentSource[]
  //chainID to Solver type mapping
  solvers: Record<number, Solver>
  logger: {
    usePino: boolean
    pinoConfig: PinoParams
  }
  liquidityManager: LiquidityManagerConfig
  liFi: LiFiConfigType
  indexer: IndexerConfig
  withdraws: WithdrawsConfig
  sendBatch: SendBatchConfig
  hyperlane: HyperlaneConfig
  crowdLiquidity: CrowdLiquidityConfig
  CCTP: CCTPConfig
  warpRoutes: WarpRoutesConfig
  cctpLiFi: CCTPLiFiConfig
}

export type EcoConfigKeys = keyof EcoConfigType

/**
 * The config type for the launch darkly feature flagging service
 */
export type LaunchDarklyConfig = {
  apiKey: string
  options?: LDOptions
}

/**
 * The configs for the fulfillment params
 */
export type FulfillType = {
  run: 'batch' | 'single'
  type?: 'crowd-liquidity' | 'smart-wallet-account'
}

/**
 * The config type for the safe multisig wallet
 */
export type SafeType = {
  owner?: Hex
}

/**
 * The config type for the redis section
 */
export type RedisConfig = {
  connection: ClusterNode | ClusterNode[]
  options: {
    single: Redis.RedisOptions
    cluster: Redis.ClusterOptions
  }
  redlockSettings?: Partial<Settings>
  jobs: {
    intentJobConfig: JobsOptions
    watchJobConfig: JobsOptions
  }
}

/**
 * The config type for the intervals section
 */
export type IntervalConfig = {
  retryInfeasableIntents: {
    repeatOpts: Omit<RepeatOptions, 'key'>
    jobTemplate: {
      name?: string
      opts: Omit<JobsOptions, 'jobId' | 'repeat' | 'delay'>
    }
  }
  balanceRpcUpdate: {
    repeatOpts: Omit<RepeatOptions, 'key'>
    jobTemplate: {
      name?: string
      data?: object
    }
  }
  defaults: {
    repeatOpts: Omit<RepeatOptions, 'key'>
    jobTemplate?: {
      name?: string
      opts?: Omit<JobsOptions, 'jobId' | 'repeat' | 'delay'>
    }
  }
}

/**
 * The config type for the intent section
 */
export type IntentConfig = {
  defaultFee: FeeConfigType
  skipBalanceCheck?: boolean
  proofs: {
    hyperlane_duration_seconds: number
    metalayer_duration_seconds: number
  }
  isNativeETHSupported: boolean
}

/**
 * The config type for the fulfillment estimate section
 */
export type FulfillmentEstimateConfig = {
  executionPaddingSeconds: number
  blockTimePercentile: number
  defaultBlockTime: number
}

export type ServerConfig = {
  url: string
}

export type GasEstimationsConfig = {
  fundFor: bigint // 150_000n
  permit: bigint // 60_000n
  permit2: bigint // 80_000n
  defaultGasPriceGwei: string // 30
}

/**
 * The config type for the quotes section
 */
export type QuoteExecutionType = (typeof IntentExecutionTypeKeys)[number]

export type QuotesConfig = {
  intentExecutionTypes: QuoteExecutionType[]
}

export type SolverRegistrationConfig = {
  apiOptions: {
    baseUrl: string
  }
}

/**
 * The config type for the aws credentials
 */
export type AwsCredential = {
  region: string
  secretID: string
}

/**
 * The config type for the aws kms
 */
export type KmsConfig = {
  region: string
  keyID: string
}

/**
 * The config type for a ERC20 transfer
 */
export type V2Limits = {
  // The maximum amount of tokens that can be filled in a single transaction,
  // defaults to 1000 USDC decimal 6 equivalent {@link ValidationService.DEFAULT_MAX_FILL_BASE_6}
  tokenBase6: bigint
  // The max native gas that can be filled in a single transaction
  nativeBase18: bigint
}

export type FeeConfigType<T extends FeeAlgorithm = 'linear'> = {
  limit: V2Limits
  algorithm: T
  constants: FeeAlgorithmConfig<T>
}

/**
 * The config type for a whitelisted address for a set of chains
 * Chains must be explicitly listed in the chainIDs array
 */
export type FeeConfigDefaultType = FeeConfigType & {
  chainIDs: number[]
}

/**
 * The config type for fees for a whitelisted address
 */
export type FeeChainType = {
  [chainID: number]: FeeConfigType
  default?: FeeConfigDefaultType
}

/**
 * The config type for a fee record for whitelisted addresses. A default is
 * partial FeeConfigType, so that it can be overridden by chain specific fees.
 */
export type WhitelistFeeRecord = {
  [whitelistedWalletAddress: Hex]: Partial<FeeChainType>
}

/**
 * The config type for the auth section of the database.
 */
export type MongoAuthType = {
  enabled: boolean
  username: string
  password: string
  type: string
}

/**
 * The whole config type for alchemy.
 */
export type AlchemyConfigType = {
  apiKey: string
  networks: AlchemyNetwork[]
}

export type AlchemyNetwork = {
  name: Network
  id: number
}

/**
 * The config type for the RPC section
 */
export type RpcConfigType = {
  config: {
    webSockets?: boolean
  }
  keys: {
    [key in keyof typeof ConfigRegex]?: string
  }
  custom?: Record<
    string, // Chain ID
    {
      http?: string[]
      webSocket?: string[]
      config?: WebSocketTransportConfig | HttpTransportConfig
    }
  >
}

/**
 * The config type for a single solver configuration
 */
export type Solver = {
  inboxAddress: Hex
  //target address to contract type mapping
  targets: Record<Hex, TargetContract>
  network: Network
  fee: FeeConfigType
  chainID: number

  // The maximum amount of gas tokens that we want to hold in the solver's wallet for the chain
  nativeMax: bigint

  // The average block time for the chain in seconds
  averageBlockTime: number
}

/**
 * The fee algorithm types
 */
export type FeeAlgorithm = 'linear' | 'quadratic'

/**
 * The fee algorithm constant config types
 */
export type FeeAlgorithmConfig<T extends FeeAlgorithm> = T extends 'linear'
  ? {
      token: FeeAlgoLinear
      native: FeeAlgoLinear
    }
  : T extends 'quadratic'
    ? {
        token: FeeAlgoQuadratic
        native: FeeAlgoQuadratic
      }
    : never

export type FeeAlgoLinear = { baseFee: bigint; tranche: { unitFee: bigint; unitSize: bigint } }
export type FeeAlgoQuadratic = { baseFee: bigint; quadraticFactor: bigint }

/**
 * The config type for a supported target contract
 */
export interface TargetContract {
  contractType: TargetContractType
  selectors: string[]
  minBalance: number
  targetBalance: number
  maxBalance: number
}

/**
 * The types of contracts that we support
 */
export type TargetContractType = 'erc20' | 'erc721' | 'erc1155'

/**
 * Defaults to append any provers in configs to the npm package
 */
export const ProverEcoRoutesProverAppend = 'append'
/**
 * The config type for a single prover source configuration
 */
export class IntentSource {
  // The network that the prover is on
  network: Network
  // The chain ID of the network
  chainID: number
  // The address that the IntentSource contract is deployed at, we read events from this contract to fulfill
  sourceAddress: Hex
  // The address that the Inbox contract is deployed at, we execute fulfills in this contract
  inbox: Hex
  // The addresses of the tokens that we support as rewards
  tokens: Hex[]
  // The addresses of the provers that we support
  provers: Hex[]
  // custom configs for the intent source
  config?: {
    // Defaults to append, @eco-foundation/routes-ts provers will append to the provers in configs
    ecoRoutes: 'append' | 'replace'
  }
}

export interface LiquidityManagerConfig {
  enabled?: boolean
  // The maximum slippage around target balance for a token
  targetSlippage: number
  // Maximum allowed slippage for quotes (e.g., 0.05 for 5%)
  maxQuoteSlippage: number
  swapSlippage?: number
  intervalDuration: number
  thresholds: {
    surplus: number // Percentage above target balance
    deficit: number // Percentage below target balance
  }
  // Core tokens are used as intermediaries between two chains
  coreTokens: {
    token: Hex
    chainID: number
  }[]
  walletStrategies: {
    [walletName: string]: Strategy[]
  }
}

export interface LiFiConfigType {
  integrator: string
  apiKey?: string
}

export interface IndexerConfig {
  url: string
}

export interface WithdrawsConfig {
  chunkSize: number
  intervalDuration: number
}

export interface SendBatchConfig {
  chunkSize: number
  intervalDuration: number
  defaultGasPerIntent: number
}

export interface HyperlaneConfig {
  useHyperlaneDefaultHook?: boolean
  chains: Record<
    string, // Chain ID
    {
      mailbox: Hex
      aggregationHook: Hex
      hyperlaneAggregationHook: Hex
    }
  >
}

export interface CrowdLiquidityConfig {
  litNetwork: LIT_NETWORKS_KEYS
  capacityTokenId: string
  capacityTokenOwnerPk: string
  defaultTargetBalance: number
  feePercentage: number
  actions: {
    fulfill: string
    rebalance: string
  }
  kernel: {
    address: string
  }
  pkp: {
    ethAddress: string
    publicKey: string
  }
  supportedTokens: { chainId: number; tokenAddress: Hex }[]
}

export interface CCTPConfig {
  apiUrl: string
  chains: {
    chainId: number
    domain: number
    token: Hex
    tokenMessenger: Hex
    messageTransmitter: Hex
  }[]
}

export interface WarpRoutesConfig {
  routes: {
    collateral: {
      chainId: number
      token: Hex
    }
    chains: {
      chainId: number
      token: Hex
      synthetic: Hex
    }[]
  }[]
}

export interface IndexerConfig {
  url: string
}

export interface WithdrawsConfig {
  chunkSize: number
  intervalDuration: number
}

export interface SendBatchConfig {
  chunkSize: number
  intervalDuration: number
  defaultGasPerIntent: number
}

export interface HyperlaneConfig {
  useHyperlaneDefaultHook?: boolean
}

export interface CCTPLiFiConfig {
  maxSlippage: number
  usdcAddresses: Record<number, Hex>
}
