/**
 * Mathb is a utility class for bigint operations.
 */
export declare class Mathb {
    /**
     * Get the absolute value of a bigint.
     * @param x the number
     * @returns
     */
    static abs(x: bigint): bigint;
    /**
     * Get the minimum of two bigints.
     * @param x first bigint
     * @param y second bigint
     * @returns
     */
    static min(x: bigint, y: bigint): bigint;
    /**
     * Get the maximum of two bigints.
     * @param x first bigint
     * @param y second bigint
     * @returns
     */
    static max(x: bigint, y: bigint): bigint;
    /**
     * Compares two bigints. Returns 0 if they are equal, 1 if x is greater than y, and -1 if x is less than y.
     * Usefull for sorting.
     * @param x first bigint
     * @param y second bigint
     * @returns
     */
    static compare(x: bigint, y: bigint): number;
}
