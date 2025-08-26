/**
 * Branded types for TVM addresses to ensure type safety
 */

/**
 * Tron address in base58 format (starts with 'T')
 */
export type TronAddress = string & { readonly _brand: 'TronAddress' };

/**
 * Tron address in hex format (41 prefix for mainnet)
 */
export type TronHexAddress = string & { readonly _brand: 'TronHexAddress' };

/**
 * Type guard to check if a string is a valid Tron base58 address
 * @param address - The address to check
 * @returns true if the address is a valid Tron address
 */
export function isTronAddress(address: string): address is TronAddress {
  return /^T[a-zA-Z0-9]{33}$/.test(address);
}

/**
 * Type guard to check if a string is a valid Tron hex address
 * @param address - The address to check
 * @returns true if the address is a valid Tron hex address
 */
export function isTronHexAddress(address: string): address is TronHexAddress {
  // Must be 42 characters (21 bytes in hex) and start with 41
  return /^41[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Creates a TronAddress type from a string after validation
 * @param address - The address string
 * @returns TronAddress type
 * @throws Error if the address is invalid
 */
export function createTronAddress(address: string): TronAddress {
  if (!isTronAddress(address)) {
    throw new Error(`Invalid Tron address: ${address}`);
  }
  return address as TronAddress;
}

/**
 * Creates a TronHexAddress type from a string after validation
 * @param address - The hex address string
 * @returns TronHexAddress type
 * @throws Error if the address is invalid
 */
export function createTronHexAddress(address: string): TronHexAddress {
  if (!isTronHexAddress(address)) {
    throw new Error(`Invalid Tron hex address: ${address}`);
  }
  return address as TronHexAddress;
}
