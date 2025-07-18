import { TokenBalance } from '@/balance/types'
import { multiplyByPercentage } from '@/common/utils/math'

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
 * Calculates the slippage between the fromAmount and the toAmountMin.
 * @param toAmountMin - The minimum amount of tokens received.
 * @param fromAmount - The amount of tokens sent.
 * @returns The slippage as a percentage.
 */
export function getSlippage(toAmountMin: string, fromAmount: string): number {
  const toAmountMinBigInt = BigInt(toAmountMin)
  const fromAmountBigInt = BigInt(fromAmount)

  if (fromAmountBigInt === 0n) {
    return 0
  }
  // To avoid floating point inaccuracies with large numbers, we perform the division using BigInts.
  // We multiply by 10000 to preserve 4 decimal places of precision for the percentage.
  const slippage =
    Number(((fromAmountBigInt - toAmountMinBigInt) * 10000n) / fromAmountBigInt) / 10000

  return slippage
}
