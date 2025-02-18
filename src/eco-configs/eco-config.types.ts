import { Network } from 'alchemy-sdk'
import { ClusterNode } from 'ioredis'
import { Params as PinoParams } from 'nestjs-pino'
import * as Redis from 'ioredis'
import { Settings } from 'redlock'
import { JobsOptions, RepeatOptions } from 'bullmq'
import { Hex } from 'viem'
import { LDOptions } from '@launchdarkly/node-server-sdk'
import { CacheModuleOptions } from '@nestjs/cache-manager'
import { LIT_NETWORKS_KEYS } from '@lit-protocol/types'

// The config type that we store in json
export type EcoConfigType = {
  server: {
    url: string
  }
  externalAPIs: unknown
  redis: RedisConfig
  intervals: IntervalConfig
  intentConfigs: IntentConfig
  alchemy: AlchemyConfigType
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
  crowdLiquidity: CrowdLiquidityConfig
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
  proofs: {
    storage_duration_seconds: number
    hyperlane_duration_seconds: number
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
 * The config type for a single solver configuration
 */
export type Solver<T extends FeeAlgorithm = FeeAlgorithm> = {
  inboxAddress: Hex
  //target address to contract type mapping
  targets: Record<Hex, TargetContract>
  network: Network
  fee: FeeType<T>
  chainID: number
}

/**
 * The fee type algorithm along with its constants
 */
export type FeeType<T extends FeeAlgorithm> = {
  feeAlgorithm: FeeAlgorithm
  constants: FeeAlgorithmConfig<T>
}

/**
 * The fee algorithm types
 */
export type FeeAlgorithm = 'linear' | 'quadratic'

/**
 * The fee algorithm constant config types
 */
export type FeeAlgorithmConfig<T extends FeeAlgorithm> = T extends 'linear'
  ? { baseFee: bigint; per100UnitFee: bigint }
  : T extends 'quadratic'
    ? { baseFee: bigint; quadraticFactor: bigint }
    : never

/**
 * The config type for a supported target contract
 */
export interface TargetContract {
  contractType: TargetContractType
  selectors: string[]
  minBalance: number
  targetBalance: number
}

/**
 * The types of contracts that we support
 */
export type TargetContractType = 'erc20' | 'erc721' | 'erc1155'

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
  // The addresses of the tokens that we support as rewards
  tokens: Hex[]
  // The addresses of the provers that we support
  provers: Hex[]
}

export interface LiquidityManagerConfig {
  // The maximum slippage around target balance for a token
  targetSlippage: number
  intervalDuration: number
  thresholds: {
    surplus: number // Percentage above target balance
    deficit: number // Percentage below target balance
  }
}

export interface CrowdLiquidityConfig {
  litNetwork: LIT_NETWORKS_KEYS
  litActionIpfsId: string
  capacityTokenId: string
  capacityTokenOwnerPk: string
  kernel: {
    address: string
  }
  pkp: {
    ethAddress: string
    publicKey: string
  }
}
