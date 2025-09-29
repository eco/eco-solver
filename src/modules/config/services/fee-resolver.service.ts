import { Injectable } from '@nestjs/common';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { AssetsFeeSchemaType } from '@/config/schemas/fee.schema';
import { ChainIdentifier } from '@/modules/token/types/token.types';

import { BlockchainConfigService } from './blockchain-config.service';
import { FulfillmentConfigService } from './fulfillment-config.service';

/**
 * Service that resolves fee configuration based on hierarchy:
 * Token fee > Network fee > Fulfillment default fee
 */
@Injectable()
export class FeeResolverService {
  constructor(
    private readonly blockchainConfigService: BlockchainConfigService,
    private readonly fulfillmentConfigService: FulfillmentConfigService,
  ) {}

  /**
   * Resolves the fee configuration for a specific chain and token
   * @param chainId The chain identifier
   * @param tokenAddress Optional token address to check for token-specific fee
   * @returns The resolved fee configuration based on hierarchy
   */
  resolveFee(chainId: ChainIdentifier, tokenAddress?: UniversalAddress): AssetsFeeSchemaType {
    // 1. Check for token-specific fee (highest priority)
    if (tokenAddress) {
      try {
        const tokenConfig = this.blockchainConfigService.getTokenConfig(chainId, tokenAddress);
        if (tokenConfig.fee) {
          return tokenConfig.fee;
        }
      } catch {
        // Token not found, continue to network fee
      }
    }

    // 2. Check for network-specific fee (medium priority)
    try {
      const networkFee = this.blockchainConfigService.getFeeLogic(chainId);
      if (networkFee) {
        return networkFee;
      }
    } catch {
      // Network fee not found, continue to default
    }

    // 3. Use fulfillment default fee (lowest priority)
    const defaultFee = this.fulfillmentConfigService.fulfillmentConfig.defaultFee;
    if (defaultFee) {
      return defaultFee;
    }

    // 4. If no fee configuration found at any level, throw error
    throw new Error(`No fee configuration found for chain ${chainId}`);
  }

  /**
   * Resolves the fee configuration for native token transfers on a specific chain
   * @param chainId The chain identifier
   * @returns The resolved fee configuration for native transfers
   */
  resolveNativeFee(chainId: ChainIdentifier): AssetsFeeSchemaType {
    // For native transfers, only check network and default fees
    return this.resolveFee(chainId);
  }
}
