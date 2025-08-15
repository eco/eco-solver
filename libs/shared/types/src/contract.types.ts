/**
 * Shared contract and balance types to prevent circular dependencies
 */

import { Hex, Prettify, HttpTransportConfig, WebSocketTransportConfig } from 'viem'

/**
 * Base call data interface for route calls
 */
export interface BaseCallData {
  target: Hex
  data: Hex
  value: bigint
}

/**
 * Base token amount interface for rewards
 */
export interface BaseTokenAmount {
  token: Hex
  amount: bigint
}

/**
 * Base route type interface
 */
export interface BaseRouteType {
  salt?: Hex
  source: bigint
  destination: bigint
  inbox: Hex
  tokens: BaseTokenAmount[]
  calls: BaseCallData[]
}

/**
 * Base reward type interface
 */
export interface BaseRewardType {
  creator: Hex
  prover: Hex
  deadline: bigint
  nativeValue: bigint
  tokens: BaseTokenAmount[]
}

/**
 * The types of contracts that we support
 */
export type TargetContractType = 'erc20' | 'erc721' | 'erc1155'

/**
 * Configuration for a token including balance targets
 */
export type TokenConfig = {
  address: Hex
  chainId: number
  minBalance: number
  targetBalance: number
  type: TargetContractType
}

/**
 * Current balance information for a token
 */
export type TokenBalance = {
  address: Hex
  decimals: number
  balance: bigint
}

/**
 * Available liquidity management strategies
 */
export type Strategy =
  | 'LiFi'
  | 'CCTP'
  | 'WarpRoute'
  | 'CCTPLiFi'
  | 'Relay'
  | 'Stargate'
  | 'Squid'
  | 'CCTPV2'
  | 'Everclear'

/**
 * The type for the route calls that the sender wants to make.
 * @param target denotes the target address of the call
 * @param data denotes the data of the call
 * @param value denotes the native token value of the call
 */
export type CallDataType = BaseCallData

/**
 * The type for the reward tokens that the sender has and wants to send.
 * @param token denotes the token address
 * @param amount denotes the amount of tokens the caller wants to send
 */
export type RewardTokensType = BaseTokenAmount

/**
 * Define the interface for the calls field in the IntentSource event
 */
export interface CallDataInterface extends CallDataType {}

/**
 * Define the interface for the token amount field in the IntentSource event
 */
export interface RewardTokensInterface extends RewardTokensType {}

/**
 * Network identifier type (typically chain name or network name)
 */
export type Network = string

/**
 * Generic token data structure
 */
export interface TokenData {
  chainId: number
  balance: any
  config: any
}

/**
 * Generic strategy context for database schemas
 */
export type StrategyContext = any

/**
 * Transport configuration type
 */
export type TransportConfig =
  | { isWebsocket: true; config?: WebSocketTransportConfig }
  | { isWebsocket?: false; config?: HttpTransportConfig }

/**
 * Export base types for use in other libraries
 */
export type { BaseRouteType as RouteType, BaseRewardType as RewardType }