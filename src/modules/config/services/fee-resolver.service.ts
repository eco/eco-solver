import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { AssetsFeeSchemaType, FeeSchemaType, RouteFeeOverride } from '@/config/schemas/fee.schema';
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
    const override = this.findRouteOverride(
      destinationChainId,
      destinationTokenAddress,
      sourceChainId,
      sourceTokenAddress,
    );
    const matched = this.isNonSwapMatch(
      destinationChainId,
      destinationTokenAddress,
      sourceChainId,
      sourceTokenAddress,
    );

    // 0. Route-level exact override (srcChain+srcToken -> dstChain+dstToken)
    if (override) {
      const feeKind = matched ? 'nonSwapTokens' : 'tokens';
      span?.setAttributes({
        'fee.source': 'routeOverride',
        'fee.kind': feeKind,
        'fee.nonSwapGroups.matched': matched,
      });
      return override.fee[feeKind as 'tokens' | 'nonSwapTokens'];
    }

    const feeConfig = this.resolveFee(destinationChainId, destinationTokenAddress);
    // 1. Non-swap match (medium priority)
    if (matched) {
      span?.setAttributes({ 'fee.kind': 'nonSwapTokens', 'fee.nonSwapGroups.matched': true });
      return feeConfig.nonSwapTokens;
    }
    // 2. Swap match (lowest priority)
    span?.setAttributes({ 'fee.kind': 'tokens', 'fee.nonSwapGroups.matched': false });
    return feeConfig.tokens;
  }

  /**
   * Resolves the fee configuration for native token transfers on a specific chain
   * @param chainId The chain identifier
   * @returns The resolved fee configuration for native transfers
   */
  resolveNativeFee(chainId: ChainIdentifier): FeeSchemaType | undefined {
    // Native transfers do not use route-level token overrides; resolve via network/default hierarchy only
    const span = api.trace.getActiveSpan();
    span?.setAttributes({ 'fee.kind': 'native', 'fee.destinationChainId': String(chainId) });
    return this.resolveFee(chainId).native;
  }

  private isNonSwapMatch(
    destinationChainId?: ChainIdentifier,
    destinationTokenAddress?: UniversalAddress,
    sourceChainId?: ChainIdentifier,
    sourceTokenAddress?: UniversalAddress,
  ): boolean {
    if (!destinationChainId || !destinationTokenAddress || !sourceChainId || !sourceTokenAddress) {
      return false;
    }
    try {
      const src = this.blockchainConfigService.getTokenConfig(sourceChainId, sourceTokenAddress);
      const dst = this.blockchainConfigService.getTokenConfig(
        destinationChainId,
        destinationTokenAddress,
      );
      return Boolean(
        src?.nonSwapGroups?.length &&
          dst?.nonSwapGroups?.length &&
          src.nonSwapGroups!.some((g) => dst.nonSwapGroups!.includes(g)),
      );
    } catch {
      return false;
    }
  }

  private findRouteOverride(
    destinationChainId?: ChainIdentifier,
    destinationTokenAddress?: UniversalAddress,
    sourceChainId?: ChainIdentifier,
    sourceTokenAddress?: UniversalAddress,
  ): RouteFeeOverride | undefined {
    const overrides =
      this.fulfillmentConfigService.routeFeeOverrides ??
      this.fulfillmentConfigService.fulfillmentConfig.routeFeeOverrides;
    if (!overrides?.length) return undefined;
    if (!destinationChainId || !destinationTokenAddress || !sourceChainId || !sourceTokenAddress) {
      return undefined;
    }
    const match = (overrides as RouteFeeOverride[]).find(
      (o: RouteFeeOverride) =>
        String(o.sourceChainId) === String(sourceChainId) &&
        String(o.destinationChainId) === String(destinationChainId) &&
        o.sourceToken.toLowerCase() === String(sourceTokenAddress).toLowerCase() &&
        o.destinationToken.toLowerCase() === String(destinationTokenAddress).toLowerCase(),
    );
    return match;
  }
}
