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
}
