/**
 * Shared contract and balance types to prevent circular dependencies
 */

import { Hex, Prettify } from 'viem'
import { RewardType, RouteType } from '@eco/foundation-eco-adapter'

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
export type CallDataType = RouteType['calls'][number]

/**
 * The DTO for the reward tokens that the sender has and wants to send.
 * @param token denotes the token address
 * @param amount denotes the amount of tokens the caller wants to send
 * @param balance denotes the amount of tokens the caller can send
 */
export type RewardTokensType = Prettify<RewardType['tokens'][number]>

/**
 * Define the interface for the calls field in the IntentSource event
 */
export interface CallDataInterface extends CallDataType {}

/**
 * Define the interface for the token amount field in the IntentSource event
 */
export interface RewardTokensInterface extends RewardTokensType {}