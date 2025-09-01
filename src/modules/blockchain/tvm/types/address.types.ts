/**
 * Branded types for TVM addresses to ensure type safety
 */

/**
 * Tron address in base58 format (starts with 'T')
 */
export type TronAddress = `T${string}` & { readonly _brand: 'TronAddress' };
