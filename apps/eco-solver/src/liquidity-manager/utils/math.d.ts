export declare function getSlippageRange(amount: bigint, slippage: number): {
    min: bigint;
    max: bigint;
};
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
export declare function getTotalSlippage(slippages: number[]): number;
/**
 * Calculates the slippage between the fromAmount and the toAmountMin.
 * @param toAmountMin - The minimum amount of tokens received.
 * @param fromAmount - The amount of tokens sent.
 * @returns The slippage as a percentage.
 */
export declare function getSlippage(toAmountMin: string, fromAmount: string): number;
