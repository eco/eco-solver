/**
 * Calculate sum of bigint values or a specific property of objects
 * @param items - Array of bigint values or objects
 * @param key - Optional key to extract value from objects
 * @returns Sum as bigint
 */
export function sum<
  Item extends bigint | Record<string, unknown>,
  Key extends Item extends bigint ? never : keyof Item,
>(items: Item[], key?: Key): bigint {
  if (items.length === 0) return 0n;

  // For bigint arrays
  if (typeof items[0] === 'bigint') {
    return (items as bigint[]).reduce((acc, val) => acc + val, 0n);
  }

  // For object arrays with a key
  if (key) {
    return (items as Record<string, unknown>[]).reduce((acc, item) => {
      const value = item[key as string];
      return acc + (typeof value === 'bigint' ? value : 0n);
    }, 0n);
  }

  return 0n;
}

/**
 * Find minimum value in array of bigints
 * @param amounts - Array of bigint values
 * @returns Minimum value
 */
export function min(amounts: bigint[]): bigint {
  if (amounts.length === 0) return 0n;

  // For bigint comparison, we need to be careful with Number conversion
  // Use reduce for accurate bigint comparison
  return amounts.reduce((min, current) => (current < min ? current : min), amounts[0]);
}

/**
 * Find maximum value in array of bigints
 * @param amounts - Array of bigint values
 * @returns Maximum value
 */
export function max(amounts: bigint[]): bigint {
  if (amounts.length === 0) return 0n;

  // For bigint comparison, we need to be careful with Number conversion
  // Use reduce for accurate bigint comparison
  return amounts.reduce((max, current) => (current > max ? current : max), amounts[0]);
}
