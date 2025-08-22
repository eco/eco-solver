import { Hex } from 'viem';
/**
 * Lowercase all top-level keys of the given `object` to lowercase.
 *
 * @returns {Object}
 */
export declare function addressKeys(obj: Record<Hex, any>): Record<Hex, any>;
/**
 * Recursively converts all BigInt values in an object to strings.
 *
 * @param {Object} obj - The object to process.
 * @returns {Object} - The new object with BigInt values as strings.
 */
export declare function convertBigIntsToStrings(obj: any): any;
/**
 *  Checks if the data is empty. It checks if the data is '0x' or if it has only 0 characters.
 * @param data the data to check
 * @returns
 */
export declare function isEmptyData(data: Hex): boolean;
