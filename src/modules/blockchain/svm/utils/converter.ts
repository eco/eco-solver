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
