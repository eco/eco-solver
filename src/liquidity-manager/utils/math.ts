import { multiplyByPercentage } from '@/common/utils/math'

export function getRangeFromPercentage(
  amount: bigint,
  percentage: { up: number; down: number },
): { min: bigint; max: bigint } {
  const min = multiplyByPercentage(amount, 1 - percentage.down)
  const max = multiplyByPercentage(amount, 1 + percentage.up)

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
