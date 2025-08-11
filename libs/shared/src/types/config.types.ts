import * as Redis from "ioredis"
import type { ClusterNode } from "ioredis"
import type { Settings } from 'redlock'
import type { JobsOptions } from 'bullmq'
import type { Chain } from 'viem/chains'
import type { Hex } from 'viem'
import type { HttpTransportConfig, WebSocketTransportConfig } from 'viem'

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
 * KMS configuration type
 */
export type KmsConfig = {
  region: string
  keyID: string
}

/**
 * RPC configuration return type
 */
export type RpcConfigResult = { rpcUrls: string[]; config: HttpTransportConfig | WebSocketTransportConfig }

/**
 * Eth configuration type
 */
export type EthConfig = {
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

/**
 * EcoSolver configuration type (different from the basic Solver in common.types)
 */
export type EcoSolver = {
  chainID: number
  inboxAddress?: Hex
  targets?: Record<string, Hex>
  [key: string]: any
}

/**
 * Interface for configuration service
 * This avoids circular dependencies by defining the interface in shared
 */
export interface IEcoConfigService {
  getRedis(): RedisConfig
  getKmsConfig(): KmsConfig
  getEth(): EthConfig
  getSolvers(): Record<number, EcoSolver>
  getRpcUrls(chain: Chain): RpcConfigResult
  get(key: string): any
}
