import { TokenBalance, TokenConfig } from '@/balance/types'
import { TokenState } from '@/liquidity-manager/types/token-state.enum'
import { getRangeFromPercentage } from '@/liquidity-manager/utils/math'
import { Mathb } from '@/utils/bigint'
import {
  TokenAnalysis,
  TokenBalanceAnalysis,
  TokenDataAnalyzed,
} from '@/liquidity-manager/types/types'
import { BASE_DECIMALS } from '@/intent/utils'

/**
 * Analyzes a token's balance against its configuration and returns the analysis.
 * @param tokenConfig - The configuration of the token.
 * @param tokenBalance - The current balance of the token.
 * @param percentage - The percentage thresholds for up and down.
 * @returns The analysis of the token's balance.
 */
export function analyzeToken(
  tokenConfig: TokenConfig,
  tokenBalance: TokenBalance,
  percentage: { down: number; up: number; targetSlippage: number },
): TokenAnalysis {
  const { decimals } = tokenBalance
  // Use current decimals since everything is normalized to BASE_DECIMALS
  const config = toTokenBalance(tokenConfig, decimals.current)
  // Calculate the maximum and minimum acceptable balances
  const { min: minimum, max: maximum } = getRangeFromPercentage(config, percentage)

  // Create a balance analysis object
  const balance: TokenBalanceAnalysis = {
    current: tokenBalance.balance,
    maximum,
    minimum,
    target: config.balance,
  }

  // Determine the state of the token based on its balance
  const state = getTokenState(balance)
  // Calculate the difference between the current balance and the target balance
  const diff = getTokenBalanceDiff(balance)
  const targetSlippage = getRangeFromPercentage(config, percentage)

  return { balance, diff, state, targetSlippage }
}

/**
 * Determines the state of a token based on its balance.
 * @param balance - The balance analysis of the token.
 * @returns The state of the token.
 */
function getTokenState(balance: TokenBalanceAnalysis): TokenState {
  const { current, minimum, maximum } = balance
  if (current > maximum) return TokenState.SURPLUS
  if (current < minimum) return TokenState.DEFICIT
  return TokenState.IN_RANGE
}

/**
 * Calculates the absolute difference between the current balance and the target balance of a token.
 * @param balance - The balance analysis of the token.
 * @returns The absolute difference of tokens balance and the target balance.
 */
function getTokenBalanceDiff(balance: TokenBalanceAnalysis): bigint {
  return Mathb.abs(balance.current - balance.target)
}

/**
 * Analyzes a group of tokens and returns the total difference and the items in the group.
 * @param group - The group of analyzed token data.
 * @returns The total difference and the items in the group.
 */
export function analyzeTokenGroup(group: TokenDataAnalyzed[]) {
  // Sort the group by diff in descending order
  const items = group.sort((a, b) =>
    Mathb.compare(
      // Balances are already normalized to BASE_DECIMALS by balance service
      b.analysis.diff,
      a.analysis.diff,
    ),
  )
  // Calculate the total difference for the group
  const total = getGroupTotal(items)
  return { total, items }
}

/**
 * Calculates the total normalized difference of a group of analyzed token data.
 * @param group - The group of analyzed token data.
 * @returns The total normalized difference of the group.
 */
export function getGroupTotal(group: TokenDataAnalyzed[]) {
  if (!group || !Array.isArray(group) || group.length === 0) {
    return 0n
  }
  return group.reduce(
    (acc, item) => acc + (item?.analysis?.diff ?? 0n),
    0n,
  )
}

/**
 * Gets the sorted group of analyzed token data by their normalized difference in descending order.
 * @param group - The group of analyzed token data.
 * @returns
 */
export function getSortDescGroupByDiff(group: TokenDataAnalyzed[]) {
  if (!group || !Array.isArray(group)) {
    return []
  }
  // Sort the group by diff in descending order
  return [...group].sort((a, b) =>
    Mathb.compare(
      // Balances are already normalized to BASE_DECIMALS by balance service
      b.analysis.diff,
      a.analysis.diff,
    ),
  )
}

/**
 * Converts a token configuration object to a token balance object with the specified number of decimals.
 * Since configs are already normalized in eco-config service, targetBalance is already in BASE_DECIMALS.
 * @param config The token configuration object with normalized values.
 * @param decimals The current number of decimals (should be BASE_DECIMALS).
 * @returns
 */
export function toTokenBalance(config: TokenConfig, decimals: number): TokenBalance {
  return {
    address: config.address,
    decimals: { original: decimals, current: BASE_DECIMALS },
    balance: config.targetBalance, // Already normalized by eco-config service
  }
}
