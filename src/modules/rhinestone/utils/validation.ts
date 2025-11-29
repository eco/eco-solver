import { isAddress } from 'viem';

export function isValidEthereumAddress(address: string): address is `0x${string}` {
  return isAddress(address);
}

export function isValidHexData(data: string): data is `0x${string}` {
  return /^0x([a-fA-F0-9]{2})*$/.test(data);
}

export function isValidBigInt(value: string): boolean {
  try {
    const parsed = BigInt(value);
    return parsed >= 0n;
  } catch {
    return false;
  }
}

/**
 * Normalizes a caught value to a proper Error instance
 * @param error - The caught value to normalize
 * @returns A proper Error instance
 */
export function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  if (typeof error === 'object' && error !== null) {
    try {
      return new Error(JSON.stringify(error));
    } catch {
      return new Error(String(error));
    }
  }

  return new Error(String(error));
}
