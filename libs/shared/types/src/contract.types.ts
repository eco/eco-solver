/**
 * Shared contract and balance types to prevent circular dependencies
 */

import { Hex } from 'viem'

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