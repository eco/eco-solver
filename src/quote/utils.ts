/**
 * Normalizes a value by adding the decimals to it
 * @param value the value to normalize
 * @param decimals the decimals of the value to add
 * @returns
 */
export function normalize(value: bigint, decimals: number): bigint {
  if (decimals <= 1) {
    return value
  }
  return value * BigInt(10 ** decimals)
}

/**
 * De-normalizes a value by removing the decimals from it
 * @param value the value to denormalize
 * @param decimals the decimals of the value to remove
 * @returns
 */
export function denormalize(value: bigint, decimals: number): bigint {
  if (decimals <= 1) {
    return value
  }
  return value / BigInt(10 ** decimals)
}
