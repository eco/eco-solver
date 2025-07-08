/**
 * Multiplies a bigint by a percentage
 * @param int - The bigint value to multiply
 * @param percentage - The percentage as a decimal (e.g., 0.05 for 5%)
 * @returns The result of the multiplication as a bigint
 * @example
 * mul(100n, 0.05) // returns 5n
 * mul(1000n, 0.1) // returns 100n
 */
export function mul(int: bigint, percentage: number): bigint {
  const scaleFactor = 1_000_000n
  const scaledPercentage = BigInt(Math.round(percentage * Number(scaleFactor)))
  return (int * scaledPercentage) / scaleFactor
}
