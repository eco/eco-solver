import { Hex } from 'viem';
export declare function getRandomString(): string;
export declare function getDestinationNetworkAddressKey(chainID: number | bigint, tokenAddress: string): string;
/**
 * Appends the service name to the intent hash for the job id, else it will be the same for all intents
 * as they progress down the processing pipe and interfere in the queue
 *
 * @param intentHash the hash of the intent to fulfill
 * @param logIndex the transaction index of the intent to fulfill. Necessary if multiple intents are in the same transaction
 * @returns
 */
export declare function getIntentJobId(serviceName: string, intentHash: Hex | undefined, logIndex?: number): string;
/**
 * Obscures the center of a string, leaving a number of characters visible at the start and end
 * @param str the string to obscure
 * @param visibleChars number of characters at the start and end of the string to leave visible
 * @returns
 */
export declare function obscureCenter(str: string, visibleChars?: number): string;
/**
 * Checks if there are duplicated strings in the array.
 * @param arr - An array of strings to check for duplicates.
 * @returns True if duplicates exist, otherwise false.
 */
export declare function hasDuplicateStrings(arr: string[]): boolean;
