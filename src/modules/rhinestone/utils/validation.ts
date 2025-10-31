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
