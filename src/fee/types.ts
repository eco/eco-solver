import { TokenFetchAnalysis } from '@/balance/balance.service'
import { RewardTokensInterface } from '@/contracts'
import { Solver } from '@/eco-configs/eco-config.types'
import { Hex, Prettify } from 'viem'
/**
 * The response quote data
 */
export interface QuoteData {
  tokens: RewardTokensInterface[]
  expiryTime: string
}

/**
 * The normalized tokens for the quote intent
 */
export interface NormalizedTokens {
  rewardTokens: RewardTokensInterface[]
  callTokens: RewardTokensInterface[]
}

/**
 * The normalized token type
 */
export type NormalizedToken = {
  balance: bigint
  chainID: bigint
  address: Hex
  decimals: number
}

/**
 * The type for the token fetch analysis with the normalized delta
 */
export type DeficitDescending = Prettify<TokenFetchAnalysis & { delta: NormalizedToken }>

/**
 * The type for the calculated tokens
 */
export type CalculateTokensType = {
  solver: Solver
  rewards: NormalizedToken[]
  calls: NormalizedToken[]
  srcDeficitDescending: DeficitDescending[]
  destDeficitDescending: DeficitDescending[]
}
