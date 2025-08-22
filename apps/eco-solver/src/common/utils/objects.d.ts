import { Hex } from 'viem';
/**
 * Deterministically serializes an object into a JSON string
 */
export declare function serializeObject(obj: object): string;
/**
 * Hashes an object using keccak256
 */
export declare function hashObject(obj: object): Hex;
/**
 * Lowercase all top-level keys of the given `object` to lowercase.
 *
 * @returns {Object}
 */
export declare function lowercaseKeys(obj: Record<string, any>): Record<string, any> | undefined;
