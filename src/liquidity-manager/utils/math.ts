import { TokenBalance } from '@/balance/types'
import { multiplyByPercentage } from '@/common/utils/math'
import { normalizeBalance } from '@/fee/utils'
import { BASE_DECIMALS } from '@/intent/utils'

/**
 *
 * @param tokenBalance the token balance to calculate the range for
 * @param percentage the percentage range to calculate, with `up` for the upper limit and `down` for the lower limit.
 * Percentage values should be in decimal form (e.g., 0.1 for 10%).
 * @returns an object containing the minimum and maximum range values in `bigint` format.
 */
export function getRangeFromPercentage(
  tokenBalance: TokenBalance,
  percentage: { up: number; down: number },
): { min: bigint; max: bigint } {
  const min = multiplyByPercentage(tokenBalance.balance, 1 - percentage.down, tokenBalance.decimals)
  const max = multiplyByPercentage(tokenBalance.balance, 1 + percentage.up, tokenBalance.decimals)

  return { min, max }
}

/**
 * Calculates the total compounded slippage from an array of individual slippages.
 *
 * Each slippage value represents the fractional loss at a swap step (e.g., 0.02 for 2%).
 * Slippage is compounded multiplicatively — the output of one step becomes the input of the next.
 *
 * @param slippages - An array of slippage percentages, expressed as decimal numbers (e.g., 0.01 for 1%).
 * @returns The total slippage across all steps, as a decimal (e.g., 0.05 for 5%).
 *
 * @example
 * ```ts
 * const total = getTotalSlippage([0.01, 0.02, 0.015]);
 * console.log(total); // 0.0443 (or 4.43%)
 * ```
 */
export function getTotalSlippage(slippages: number[]): number {
  const totalRetained = slippages
    .map((s) => 1 - s) // Convert slippage to retained ratio
    .reduce((acc, ratio) => acc * ratio, 1) // Multiply all retained ratios

  return 1 - totalRetained
}

/**
 * Calculates the slippage percentage between two token balances.
 * Both token balances are normalized to BASE_DECIMALS before comparison.
 * @param dstTokenMin - The minimum amount of destination tokens received.
 * @param srcToken - The amount of source tokens sent.
 * @returns The slippage as a decimal number (e.g., 0.005 for 0.5% slippage).
 */
export function getSlippagePercent(dstTokenMin: TokenBalance, srcToken: TokenBalance): number {
  // Normalize both balances to BASE_DECIMALS for comparison
  const normalizedDstToken = normalizeBalance(
    { balance: dstTokenMin.balance, decimal: dstTokenMin.decimals },
    BASE_DECIMALS,
  )
  const normalizedSrcToken = normalizeBalance(
    { balance: srcToken.balance, decimal: srcToken.decimals },
    BASE_DECIMALS,
  )

  if (normalizedSrcToken.balance === 0n) {
    return 0
  }

  // To avoid floating point inaccuracies with large numbers, we perform the division using BigInts.
  // We multiply by 10000 to preserve 4 decimal places of precision for the percentage.
  const slippage =
    Number(
      ((normalizedSrcToken.balance - normalizedDstToken.balance) * 10000n) /
        normalizedSrcToken.balance,
    ) / 10000

  return slippage
}
