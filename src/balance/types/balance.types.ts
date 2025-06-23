import { Hex } from 'viem'
import { TargetContractType } from '@/eco-configs/eco-config.types'

export type TokenConfig = {
  address: Hex
  chainId: number
  minBalance: number
  targetBalance: number
  type: TargetContractType
}

export type TokenBalance = {
  address: Hex
  decimals: number
  balance: bigint
}

export interface BalanceChangeEvent {
  chainId: bigint
  tokenAddress: Hex | 'native'
  previousBalance: bigint
  newBalance: bigint
  changeAmount: bigint
  blockNumber: bigint
  blockHash: Hex
  transactionHash: Hex
  timestamp: Date
}

export interface RpcBalanceQuery {
  chainId: bigint
  tokenAddress?: Hex // undefined for native balance
  blockNumber?: bigint // undefined for latest
}

export interface RpcBalanceResult {
  chainId: bigint
  tokenAddress: Hex | 'native'
  balance: bigint
  blockNumber: bigint
  blockHash: Hex
  decimals?: number
  tokenSymbol?: string
  tokenName?: string
}

export interface BalanceManagerConfig {
  rpcUrls: Record<string, string>
  solverAddresses: Hex[]
  monitoredTokens: Record<string, Hex[]> // chainId -> token addresses
  websocketUrls: Record<string, string>
  pollIntervalMs: number
  maxRetries: number
}

export type BalanceFilter = {
  chainId?: bigint
  tokenAddress?: Hex | 'native'
  fromDate?: Date
  toDate?: Date
  limit?: number
  offset?: number
}

export type BalanceStats = {
  totalRecords: number
  latestBalance: bigint
  oldestBalance: bigint
  averageBalance: bigint
  balanceChange24h: bigint
  balanceChangePercent24h: number
}
