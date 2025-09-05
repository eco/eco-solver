/**
 * Universal Address Type System
 *
 * Provides a type-safe, chain-agnostic address representation using normalized bytes32 hex strings.
 * All addresses are stored as 32-byte hex strings (0x + 64 chars) regardless of blockchain type.
 */

import { ChainType } from '@/common/utils/chain-type-detector';
import { EvmAddress } from '@/modules/blockchain/evm/types/address';
import { SvmAddress } from '@/modules/blockchain/svm/types/address.types';
import { TronAddress } from '@/modules/blockchain/tvm/types';

/**
 * Branded type for Universal Addresses
 * This ensures type safety and prevents mixing normalized and denormalized addresses
 */
export type UniversalAddress = string & { readonly __brand: 'UniversalAddress' };

export type BlockchainAddress<chainType extends ChainType = ChainType> =
  chainType extends ChainType.TVM
    ? TronAddress
    : chainType extends ChainType.EVM
      ? EvmAddress
      : chainType extends ChainType.SVM
        ? SvmAddress
        : never;

/**
 * Pads a hex string to 32 bytes (64 hex characters)
 */
export function padTo32Bytes(hex: string): string {
  // Remove 0x prefix if present
  const cleanHex = hex.startsWith('0x') ? hex.substring(2) : hex;

  if (cleanHex.length > 64) {
    throw new Error(`Address too long to pad: ${hex}. Maximum 32 bytes allowed`);
  }

  // Pad with zeros to reach 64 characters
  const padded = cleanHex.padStart(64, '0');
  return '0x' + padded;
}

/**
 * Removes padding from a 32-byte hex string
 */
export function unpadFrom32Bytes(hex: string): string {
  // Remove 0x prefix if present
  const cleanHex = hex.startsWith('0x') ? hex.substring(2) : hex;

  // Remove leading zeros, but keep at least one character
  const unpadded = cleanHex.replace(/^0+/, '') || '0';
  return '0x' + unpadded.padStart(40, '0');
}
