/**
 * Returns the selector hash of the data, which is the first 4 bytes of the data
 *
 * @param data the hex encoded data
 * @returns
 */
export declare function getSelectorHash(data: string | undefined): string;
/**
 * Check if a string is valid hex
 * @param hex the string to check if it is hex
 * @returns
 */
export declare function isHex(num: string): boolean;
