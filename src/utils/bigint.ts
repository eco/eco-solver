/**
 * Mathb is a utility class for bigint operations.
 */
export class Mathb {
  /**
   * Get the absolute value of a bigint.
   * @param x the number
   * @returns
   */
  static abs(x: bigint): bigint {
    return x < 0 ? -x : x
  }

  /**
   * Get the minimum of two bigints.
   * @param x first bigint
   * @param y second bigint
   * @returns
   */
  static min(x: bigint, y: bigint): bigint {
    return x < y ? x : y
  }

  /**
   * Get the maximum of two bigints.
   * @param x first bigint
   * @param y second bigint
   * @returns
   */
  static max(x: bigint, y: bigint): bigint {
    return x > y ? x : y
  }

  /**
   * Compares two bigints. Returns 0 if they are equal, 1 if x is greater than y, and -1 if x is less than y.
   * Usefull for sorting.
   * @param x first bigint
   * @param y second bigint
   * @returns
   */
  static compare(x: bigint, y: bigint): number {
    return x === y ? 0 : x > y ? 1 : -1
  }
}
