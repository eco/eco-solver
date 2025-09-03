/**
 * Address Normalization Utility
 *
 * Converts between chain-native address formats and normalized UniversalAddress format.
 * Supports EVM, TVM (Tron), and SVM (Solana) blockchain types.
 */

import { PublicKey } from '@solana/web3.js';
import { TronWeb } from 'tronweb';
import { getAddress, isAddress as isViemAddress } from 'viem';

import {
  BlockchainAddress,
  padTo32Bytes,
  toUniversalAddress,
  UniversalAddress,
  unpadFrom32Bytes,
} from '@/common/types/universal-address.type';
import { ChainType } from '@/common/utils/chain-type-detector';
import { getErrorMessage } from '@/common/utils/error-handler';
import { EvmAddress } from '@/modules/blockchain/evm/types/address';
import { TronAddress } from '@/modules/blockchain/tvm/types';

export class AddressNormalizer {
  /**
   * Normalizes a chain-native address to UniversalAddress format
   * @param address - The address in chain-native format
   * @param chainType - The blockchain type
   * @returns Normalized UniversalAddress (32 bytes hex)
   */
  static normalize(address: BlockchainAddress, chainType: ChainType): UniversalAddress {
    switch (chainType) {
      case ChainType.EVM:
        return this.normalizeEvm(address as EvmAddress);
      case ChainType.TVM:
        return this.normalizeTvm(address as TronAddress);
      case ChainType.SVM:
        return this.normalizeSvm(address);
      default:
        throw new Error(`Unsupported chain type: ${chainType}`);
    }
  }

  /**
   * Denormalizes a UniversalAddress to chain-native format
   * @param address - The normalized UniversalAddress
   * @param chainType - The target blockchain type
   * @returns Address in chain-native format
   */
  static denormalize<
    chainType extends ChainType,
    Addr extends chainType extends ChainType.TVM
      ? TronAddress
      : chainType extends ChainType.EVM
        ? EvmAddress
        : chainType extends ChainType.SVM
          ? ChainType.SVM
          : never,
  >(address: UniversalAddress, chainType: chainType): Addr {
    switch (chainType) {
      case ChainType.EVM:
        return this.denormalizeToEvm(address) as Addr;
      case ChainType.TVM:
        return this.denormalizeToTvm(address) as Addr;
      case ChainType.SVM:
        return this.denormalizeToSvm(address) as Addr;
      default:
        throw new Error(`Unsupported chain type: ${chainType}`);
    }
  }

  static denormalizeToEvm(address: UniversalAddress): EvmAddress {
    // Remove padding (the last 24 characters are padding for 20-byte EVM addresses)
    const unpadded = unpadFrom32Bytes(address);

    // Take only the last 40 hex characters (20 bytes)
    const cleanHex = unpadded.substring(2); // Remove 0x
    const evmHex = cleanHex.length > 40 ? cleanHex.substring(cleanHex.length - 40) : cleanHex;

    // Validate and return checksum address
    const evmAddress = '0x' + evmHex;
    if (!isViemAddress(evmAddress)) {
      throw new Error(`Invalid EVM address after denormalization: ${evmAddress}`);
    }

    return getAddress(evmAddress);
  }

  static denormalizeToTvm(address: UniversalAddress): TronAddress {
    try {
      // Remove padding
      const unpadded = unpadFrom32Bytes(address);

      // Remove 0x prefix
      const hexAddress = unpadded.startsWith('0x41')
        ? unpadded.substring(2)
        : '41' + unpadded.substring(2);

      // Convert to base58 Tron address
      const base58Address = TronWeb.address.fromHex(hexAddress);

      if (!TronWeb.isAddress(base58Address)) {
        throw new Error(`Invalid Tron address after denormalization: ${base58Address}`);
      }

      return base58Address as TronAddress;
    } catch (error) {
      throw new Error(`Failed to denormalize to TVM address: ${getErrorMessage(error)}`);
    }
  }

  static denormalizeToSvm(address: UniversalAddress): string {
    try {
      // Remove 0x prefix
      const hex = address.substring(2);

      // Convert hex to bytes (Solana addresses are 32 bytes, no unpadding needed)
      const bytes = Buffer.from(hex, 'hex');

      // Create PublicKey from bytes
      const publicKey = new PublicKey(bytes);

      // Return base58 encoded address
      return publicKey.toBase58();
    } catch (error) {
      throw new Error(`Failed to denormalize to SVM address: ${getErrorMessage(error)}`);
    }
  }

  static normalizeEvm(address: EvmAddress): UniversalAddress {
    // Validate and checksum the address
    if (!isViemAddress(address)) {
      throw new Error(`Invalid EVM address: ${address}`);
    }

    // Get checksummed address
    const checksummed = getAddress(address);

    // Pad to 32 bytes (EVM addresses are 20 bytes, so we pad with 12 bytes of zeros)
    const normalized = padTo32Bytes(checksummed);
    return toUniversalAddress(normalized);
  }

  static normalizeTvm(address: TronAddress): UniversalAddress {
    try {
      let hexAddress: string;

      // Check if it's already hex format
      if (address.startsWith('0x')) {
        // Validate it's a proper Tron hex address
        const base58 = TronWeb.address.fromHex(address.substring(2));
        if (!TronWeb.isAddress(base58)) {
          throw new Error(`Invalid Tron hex address: ${address}`);
        }
        hexAddress = address;
      } else {
        // Assume it's base58 format
        if (!TronWeb.isAddress(address)) {
          throw new Error(`Invalid Tron base58 address: ${address}`);
        }
        // Convert to hex (Tron addresses are 21 bytes, first byte is 0x41)
        const tronHex = TronWeb.address.toHex(address);
        hexAddress = '0x' + tronHex;
      }

      // Pad to 32 bytes
      const normalized = padTo32Bytes(hexAddress);
      return toUniversalAddress(normalized);
    } catch (error) {
      throw new Error(`Failed to normalize TVM address ${address}: ${getErrorMessage(error)}`);
    }
  }

  static normalizeSvm(address: string): UniversalAddress {
    try {
      // Create PublicKey from the address
      const publicKey = new PublicKey(address);

      // Convert to bytes and then to hex
      const bytes = publicKey.toBytes();
      const hex = '0x' + Buffer.from(bytes).toString('hex');

      // Solana addresses are already 32 bytes, so no padding needed
      return toUniversalAddress(hex);
    } catch (error) {
      throw new Error(`Failed to normalize SVM address ${address}: ${getErrorMessage(error)}`);
    }
  }
}
