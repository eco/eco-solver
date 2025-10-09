import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { AssetsFeeSchemaType, FeeSchemaType } from '@/config/schemas/fee.schema';
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
  private resolveFee(
    chainId: ChainIdentifier,
    tokenAddress?: UniversalAddress,
  ): AssetsFeeSchemaType {
    const span = api.trace.getActiveSpan();
    // 1. Check for token-specific fee (highest priority)
    if (tokenAddress) {
      try {
        const tokenConfig = this.blockchainConfigService.getTokenConfig(chainId, tokenAddress);
        if (tokenConfig.fee) {
          span?.setAttributes({
            'fee.source': 'token',
            'fee.resolution.chainId': String(chainId),
            'fee.resolution.tokenAddress': tokenAddress,
          });
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
        span?.setAttributes({
          'fee.source': 'network',
          'fee.resolution.chainId': String(chainId),
        });
        return networkFee;
      }
    } catch {
      // Network fee not found, continue to default
    }

    // 3. Use fulfillment default fee (lowest priority)
    const defaultFee = this.fulfillmentConfigService.fulfillmentConfig.defaultFee;
    if (defaultFee) {
      span?.setAttributes({
        'fee.source': 'default',
        'fee.resolution.chainId': String(chainId),
      });
      return defaultFee;
    }

    // 4. If no fee configuration found at any level, throw error
    span?.setAttributes({ 'fee.source': 'none', 'fee.resolution.chainId': String(chainId) });
    throw new Error(`No fee configuration found for chain ${chainId}`);
  }

  resolveTokenFee(
    destinationChainId: ChainIdentifier,
    destinationTokenAddress?: UniversalAddress,
    sourceChainId?: ChainIdentifier,
    sourceTokenAddress?: UniversalAddress,
  ): FeeSchemaType | undefined {
    const span = api.trace.getActiveSpan();
    span?.setAttributes({
      'fee.destinationChainId': String(destinationChainId),
      'fee.sourceChainId': sourceChainId ? String(sourceChainId) : 'undefined',
      'fee.sourceToken': sourceTokenAddress ?? 'undefined',
      'fee.destinationToken': destinationTokenAddress ?? 'undefined',
    });
    const feeConfig = this.resolveFee(destinationChainId, destinationTokenAddress);

    if (sourceTokenAddress && destinationTokenAddress && sourceChainId) {
      let sourceTokenConfig: { nonSwapGroups?: string[] } | undefined;
      let destinationTokenConfig: { nonSwapGroups?: string[] } | undefined;
      try {
        sourceTokenConfig = this.blockchainConfigService.getTokenConfig(
          sourceChainId,
          sourceTokenAddress,
        );
      } catch {
        // ignore missing token config
      }
      try {
        destinationTokenConfig = this.blockchainConfigService.getTokenConfig(
          destinationChainId,
          destinationTokenAddress,
        );
      } catch {
        // ignore missing token config
      }
      // Check if the source and destination token have non-swap groups that match
      // If they do, return the non-swap fee configuration
      if (sourceTokenConfig?.nonSwapGroups && destinationTokenConfig?.nonSwapGroups) {
        if (
          sourceTokenConfig.nonSwapGroups.some((group) =>
            destinationTokenConfig.nonSwapGroups?.includes(group),
          )
        ) {
          span?.setAttributes({ 'fee.kind': 'nonSwapTokens', 'fee.nonSwapGroups.matched': true });
          return feeConfig.nonSwapTokens;
        }
      }
    }

    span?.setAttributes({ 'fee.kind': 'tokens', 'fee.nonSwapGroups.matched': false });
    return feeConfig.tokens;
  }

  /**
   * Resolves the fee configuration for native token transfers on a specific chain
   * @param chainId The chain identifier
   * @returns The resolved fee configuration for native transfers
   */
  resolveNativeFee(chainId: ChainIdentifier): FeeSchemaType | undefined {
    // For native transfers, only check network and default fees
    const span = api.trace.getActiveSpan();
    span?.setAttributes({ 'fee.kind': 'native', 'fee.destinationChainId': String(chainId) });
    return this.resolveFee(chainId).native;
  }
}
