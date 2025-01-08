import { formatUnits, parseUnits } from 'viem'
import { TokenBalance, TokenConfig } from '@/balance/types'
import { TokenState } from '@/liquidity-manager/types/token-state.enum'
import { getSlippageRange } from '@/liquidity-manager/utils/math'

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
): LiquidityManager.TokenAnalysis {
  const { decimals } = tokenBalance

  // Calculate the maximum and minimum acceptable balances
  const maximum = tokenConfig.targetBalance * (1 + percentage.up)
  const minimum = tokenConfig.targetBalance * (1 - percentage.down)

  // Create a balance analysis object
  const balance: LiquidityManager.TokenBalanceAnalysis = {
    current: tokenBalance.balance,
    maximum: parseUnits(maximum.toString(), decimals),
    minimum: parseUnits(minimum.toString(), decimals),
    target: parseUnits(tokenConfig.targetBalance.toString(), decimals),
  }

  // Determine the state of the token based on its balance
  const state = getTokenState(balance)
  // Calculate the difference between the current balance and the target balance
  const diffWei = getTokenBalanceDiff(state, balance)
  const diff = parseFloat(formatUnits(diffWei, decimals))
  const targetSlippage = getSlippageRange(
    parseUnits(tokenConfig.targetBalance.toString(), decimals),
    percentage.targetSlippage,
  )

  return { balance, diff, state, targetSlippage }
}

/**
 * Determines the state of a token based on its balance.
 * @param balance - The balance analysis of the token.
 * @returns The state of the token.
 */
function getTokenState(
  balance: LiquidityManager.TokenBalanceAnalysis,
): LiquidityManager.TokenState {
  const { current, minimum, maximum } = balance
  if (current > maximum) return TokenState.SURPLUS
  if (current < minimum) return TokenState.DEFICIT
  return TokenState.IN_RANGE
}

/**
 * Calculates the difference between the current balance and the target balance based on the token's state.
 * @param state - The state of the token.
 * @param balance - The balance analysis of the token.
 * @returns The difference between the current balance and the target balance.
 */
function getTokenBalanceDiff(
  state: LiquidityManager.TokenState,
  balance: LiquidityManager.TokenBalanceAnalysis,
): bigint {
  switch (state) {
    case TokenState.SURPLUS:
      return balance.current - balance.target
    case TokenState.DEFICIT:
      return balance.target - balance.current
    default:
      return 0n
  }
}

/**
 * Analyzes a group of tokens and returns the total difference and the items in the group.
 * @param group - The group of analyzed token data.
 * @returns The total difference and the items in the group.
 */
export function analyzeTokenGroup(group: LiquidityManager.TokenDataAnalyzed[]) {
  // Sort the group by diff in descending order
  const items = group.sort((a, b) => Number(b.analysis.diff - a.analysis.diff))
  // Calculate the total difference for the group
  const total = getGroupTotal(items)
  return { total, items }
}

export function getGroupTotal(group: LiquidityManager.TokenDataAnalyzed[]) {
  return group.reduce((acc, item) => acc + item.analysis.diff, 0)
}

export function getSortGroupByDiff(group: LiquidityManager.TokenDataAnalyzed[]) {
  return group.sort((a, b) => b.analysis.diff - a.analysis.diff)
}
