import { Injectable } from '@nestjs/common';

import { TronWeb } from 'tronweb';

import { EvmAddress } from '@/modules/blockchain/evm/types/address';
import { TronAddress } from '@/modules/blockchain/tvm/types';

/**
 * Utility service for TVM-specific operations like address conversions
 */
@Injectable()
export class TvmUtilsService {
  /**
   * Converts a Tron address to hex format (without 0x prefix)
   * @param address - Tron address in base58 format or already in hex
   * @returns Hex representation without 0x prefix
   */
  static toHex(address: TronAddress): string {
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
  static fromHex(hexAddress: string): TronAddress {
    // Remove 0x prefix if present
    const cleanHex = hexAddress.startsWith('0x') ? hexAddress.substring(2) : hexAddress;
    return TronWeb.address.fromHex(cleanHex) as TronAddress;
  }

  static fromEvm(evmAddr: EvmAddress): TronAddress {
    return TvmUtilsService.fromHex('0x41' + evmAddr.substring(2));
  }
}
