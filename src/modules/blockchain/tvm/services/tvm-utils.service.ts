import { Injectable } from '@nestjs/common';

import { TronWeb } from 'tronweb';
import { Address } from 'viem';

import { SystemLoggerService } from '@/modules/logging';

/**
 * Utility service for TVM-specific operations like address conversions
 */
@Injectable()
export class TvmUtilsService {
  constructor(private readonly logger: SystemLoggerService) {
    this.logger.setContext(TvmUtilsService.name);
  }

  /**
   * Validates if the given address is a valid Tron address
   * @param address - The address to validate
   * @returns true if valid Tron address, false otherwise
   */
  isValidAddress(address: string): boolean {
    try {
      return TronWeb.isAddress(address);
    } catch (error) {
      return false;
    }
  }

  /**
   * Converts a Tron address to hex format (without 0x prefix)
   * @param address - Tron address in base58 format or already in hex
   * @returns Hex representation without 0x prefix
   */
  toHex(address: string): string {
    // If already hex (starts with 0x), remove the prefix and return
    if (address.startsWith('0x')) {
      return address.substring(2);
    }
    // Otherwise, assume it's a Base58 address and convert
    return TronWeb.address.toHex(address);
  }

  /**
   * Converts a hex address to Tron base58 format
   * @param hexAddress - Hex address (with or without 0x prefix)
   * @returns Tron address in base58 format
   */
  fromHex(hexAddress: string): string {
    // Remove 0x prefix if present
    const cleanHex = hexAddress.startsWith('0x') ? hexAddress.substring(2) : hexAddress;
    return TronWeb.address.fromHex(cleanHex);
  }

  /**
   * Converts a Tron address to EVM-compatible hex format (with 0x prefix)
   * @param address - Tron address in base58 format
   * @returns EVM-compatible address with 0x prefix
   */
  toEvmHex(address: string): Address {
    // If already hex (starts with 0x), remove the prefix and return
    if (address.startsWith('0x')) {
      return address.substring(2) as Address;
    }
    // Otherwise, assume it's a Base58 address and convert
    return ('0x' + TronWeb.address.toHex(address).substring(2)) as Address;
  }

  /**
   * Converts an EVM hex address to Tron base58 format
   * @param hexAddress - EVM hex address with 0x prefix
   * @returns Tron address in base58 format
   */
  fromEvmHex(hexAddress: Address): string {
    return TronWeb.address.fromHex('41' + hexAddress.substring(2));
  }

  /**
   * Normalizes a Tron address to Base58 format for consistent comparison
   * Handles both Hex (0x...) and Base58 (T...) formats
   * This is the centralized method for address normalization across the codebase
   * Static method allows usage without dependency injection (e.g., in config services)
   *
   * @param address - Tron address in any format
   * @returns Base58 formatted address or original if conversion fails
   */
  static normalizeAddressToBase58(address: string): string {
    try {
      // If it's already a valid Base58 Tron address, return as-is
      if (address.startsWith('T') && TronWeb.isAddress(address)) {
        return address;
      }
      // If it's a hex address (with or without 0x prefix), convert to Base58
      if (address.startsWith('0x')) {
        // Remove 0x prefix and add Tron prefix (41)
        return TronWeb.address.fromHex('41' + address.substring(2));
      }
      // If no 0x prefix but looks like hex, try to convert
      if (/^[a-fA-F0-9]{40}$/.test(address)) {
        return TronWeb.address.fromHex('41' + address);
      }
      // Return as-is if format is unknown
      return address;
    } catch (error) {
      // If conversion fails, return original address
      return address;
    }
  }
}
