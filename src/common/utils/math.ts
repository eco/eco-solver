//Defaults to 6.(0.000001)
export const DEFAULT_DECIMAL_PRECISION = 6

/**
 * Multiplies a bigint value by a percentage, with optional decimal precision.
 * @param value - The value to multiply.
 * @param percentage - The percentage to multiply by (in basis points).
 * @param decimalPrecision - The number of decimal places to include in the result. Defaults to 6.(0.000001) {@link DEFAULT_DECIMAL_PRECISION}
 * @returns The result of the multiplication, rounded to the specified decimal precision.
 */
export function multiplyByPercentage(
  value: bigint,
  percentage: number,
  decimalPrecision: number = DEFAULT_DECIMAL_PRECISION,
): bigint {
  // Validate inputs
  if (percentage < 0 || percentage > 1) {
    throw new Error('Percentage must be between 0 and 1')
  }

  if (decimalPrecision > 12 || decimalPrecision <= 0) {
    throw new Error('Decimal precision cannot be greater than 12')
  }

  // Check for potential overflow (conservative estimate)
  const MAX_SAFE_INTERMEDIATE = 2n ** 200n // Very conservative
  if (value > MAX_SAFE_INTERMEDIATE / 10000n) {
    throw new Error('Value too large for safe multiplication')
  }
  const scale = Number(10n ** BigInt(decimalPrecision)) // Scale to handle decimal precision
  const basisPoints = BigInt(Math.floor(percentage * scale))
  return (value * basisPoints) / BigInt(scale)
}
