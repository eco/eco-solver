import { PublicKey } from '@solana/web3.js';
import { Hex } from 'viem';

import { toBuffer } from '@/modules/blockchain/svm/utils/buffer';

export function addressToBytes32(address: string): number[] {
  // Convert Solana address or hex address to 32-byte array
  if (address.startsWith('0x')) {
    return Array.from(toBuffer(address as Hex));
  }
  // For Solana base58 addresses, decode and pad/truncate to 32 bytes
  const publicKey = new PublicKey(address);
  const bytes = publicKey.toBytes();
  const result = new Uint8Array(32);
  result.set(bytes.slice(0, 32));
  return Array.from(result);
}

/**
 * Helper to convert 32-byte array to address for SVM
 */
export function bytes32ToAddress(bytes: number[] | Uint8Array): string {
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  // Check if it looks like a Solana public key (32 bytes, non-zero)
  const pubkey = new PublicKey(buffer);
  return pubkey.toString();
}
