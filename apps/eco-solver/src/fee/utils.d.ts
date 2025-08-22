import { NormalizedTotal } from './types';
type BalanceObject = {
    balance: bigint;
    decimal: number;
};
/**
 * Normalizes the balance to a new decimal precision.
 */
export declare function normalizeBalance(value: BalanceObject, targetDecimal: number): BalanceObject;
/**
 *  Normalizes the sum of two normalized totals.
 * @param a the first normalized total
 * @param b the second normalized total
 * @returns
 */
export declare function normalizeSum(a: NormalizedTotal, b: NormalizedTotal): NormalizedTotal;
/**
 * Compares two normalized totals to see if the provided amount is insufficient to cover the needed amount.
 * @param ask the required normalized total
 * @param reward the available normalized total
 * @returns true if provided is insufficient (less than needed) for either token or native, false otherwise
 */
export declare function isInsufficient(ask: NormalizedTotal, reward: NormalizedTotal): boolean;
/**
 * Compares two normalized totals to see if the first is greater or equal to the second for both token and native values.
 * @param a the first normalized total
 * @param b the second normalized total
 * @returns true if a is greater than or equal to b for both token and native values, false otherwise
 */
export declare function isGreaterEqual(a: NormalizedTotal, b: NormalizedTotal): boolean;
export declare function formatNormalizedTotal(total: NormalizedTotal): string;
export {};
