import { Injectable, Logger } from '@nestjs/common';

import { Address, getAddress, isAddressEqual } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { FeeResolverService } from '@/modules/config/services/fee-resolver.service';
import { TokenConfigService } from '@/modules/config/services/token-config.service';
import { ValidationErrorType } from '@/modules/fulfillment/enums/validation-error-type.enum';
import { ValidationError } from '@/modules/fulfillment/errors/validation.error';
import { FeeCalculationHelper } from '@/modules/fulfillment/utils/fee-calculation.helper';

import { RhinestoneConfigService } from '../../config/services/rhinestone-config.service';

import { RhinestoneContractsService } from './rhinestone-contracts.service';

/**
 * Rhinestone validation service - handles payload and execution validations.
 */
@Injectable()
export class RhinestoneValidationService {
  private readonly logger = new Logger(RhinestoneValidationService.name);

  constructor(
    private readonly contractsService: RhinestoneContractsService,
    private readonly configService: RhinestoneConfigService,
    private readonly feeResolverService: FeeResolverService,
    private readonly tokenConfigService: TokenConfigService,
  ) {}

  // ========================================
  // Payload Validations (called from ActionProcessor)
  // ========================================

  /**
   * Validate settlement layer from claim metadata
   * @param metadata The claim metadata containing settlement layer
   * @throws {Error} If settlement layer is not specified
   * @throws {ValidationError} If settlement layer is not 'ECO'
   */
  validateSettlementLayerFromMetadata(metadata?: { settlementLayer?: string }): void {
    const settlementLayer = metadata?.settlementLayer;

    if (!settlementLayer) {
      throw new Error('Settlement layer not specified in claim metadata');
    }

    if (settlementLayer !== 'ECO') {
      throw new ValidationError(
        `Unsupported settlement layer: ${settlementLayer}. Only 'ECO' is supported.`,
        ValidationErrorType.PERMANENT,
        'RhinestoneValidationService.validateSettlementLayerFromMetadata',
      );
    }
  }

  /**
   * Validate settlement layer is 'ECO'
   * @param settlementLayer The settlement layer from RelayerAction
   * @throws {ValidationError} If settlement layer is not 'ECO'
   */
  validateSettlementLayer(settlementLayer: string): void {
    if (settlementLayer !== 'ECO') {
      throw new ValidationError(
        `Unsupported settlement layer: ${settlementLayer}. Only 'ECO' is supported.`,
        ValidationErrorType.PERMANENT,
        'RhinestoneValidationService.validateSettlementLayer',
      );
    }
  }

  /**
   * Validate router address matches expected configuration
   * @param router The router address from the call
   * @param chainId The chain ID where the router should be deployed
   * @throws {ValidationError} If router address doesn't match configuration
   */
  validateRouterAddress(router: Address | string, chainId: number): void {
    const contracts = this.configService.getContracts(chainId);
    const expectedRouter = getAddress(contracts.router);
    const actualRouter = getAddress(router as Address);

    if (!isAddressEqual(actualRouter, expectedRouter)) {
      throw new ValidationError(
        `Invalid router address for chain ${chainId}. Expected ${expectedRouter}, got ${actualRouter}`,
        ValidationErrorType.PERMANENT,
        'RhinestoneValidationService.validateRouterAddress',
      );
    }
  }

  /**
   * Validate router call has zero value
   * @param value The value from the call (string or bigint)
   * @throws {ValidationError} If value is not zero
   */
  validateZeroValue(value: string | bigint): void {
    const valueBigInt = typeof value === 'string' ? BigInt(value) : value;
    if (valueBigInt !== 0n) {
      throw new ValidationError(
        `Router call must have zero value. Got ${value}`,
        ValidationErrorType.PERMANENT,
        'RhinestoneValidationService.validateZeroValue',
      );
    }
  }

  /**
   * Validate source and destination chains are different
   * @param sourceChainId The source chain ID
   * @param destChainId The destination chain ID
   * @throws {ValidationError} If chains are the same
   */
  validateDifferentChains(sourceChainId: number, destChainId: number): void {
    if (sourceChainId === destChainId) {
      throw new ValidationError(
        `Source and destination chains must be different. Both are chain ${sourceChainId}`,
        ValidationErrorType.PERMANENT,
        'RhinestoneValidationService.validateDifferentChains',
      );
    }
  }

  /**
   * Validate complete action integrity for RelayerAction
   * Validates router addresses, zero values, and cross-chain requirements
   *
   * @param claimCall The claim call details
   * @param fillCall The fill call details
   * @throws {Error} If value format is invalid
   * @throws {ValidationError} If validation fails
   */
  validateActionIntegrity(
    claimCall: { to: string; chainId: number; value: string },
    fillCall: { to: string; chainId: number; value: string },
  ): void {
    // Validate router addresses
    this.validateRouterAddress(claimCall.to, claimCall.chainId);
    this.validateRouterAddress(fillCall.to, fillCall.chainId);

    // Validate zero values on router calls
    try {
      this.validateZeroValue(claimCall.value);
    } catch (error) {
      // Re-throw with more context if conversion fails
      if (error instanceof Error && error.message.includes('Cannot convert')) {
        throw new Error(
          `Invalid claim value format: ${claimCall.value}. Must be a valid numeric string.`,
        );
      }
      throw error;
    }

    try {
      this.validateZeroValue(fillCall.value);
    } catch (error) {
      // Re-throw with more context if conversion fails
      if (error instanceof Error && error.message.includes('Cannot convert')) {
        throw new Error(
          `Invalid fill value format: ${fillCall.value}. Must be a valid numeric string.`,
        );
      }
      throw error;
    }

    // Validate cross-chain (source != destination)
    this.validateDifferentChains(claimCall.chainId, fillCall.chainId);
  }

  // ========================================
  // Execution Validations (called from FulfillmentStrategy)
  // ========================================

  /**
   * Validate adapter and arbiter addresses match configuration
   * Performs on-chain reads with caching to verify contract addresses
   *
   * @param chainId The chain ID to validate on
   * @param router The router address
   * @param type Whether validating fill or claim adapter
   * @param selector The function selector
   * @param options Optional configuration
   * @param options.skipOnChain Skip expensive on-chain calls (for quoting)
   * @throws {ValidationError} If adapter or arbiter doesn't match configuration
   */
  async validateAdapterAndArbiter(
    chainId: number,
    router: Address,
    type: 'fill' | 'claim',
    selector: `0x${string}`,
    options: { skipOnChain?: boolean } = {},
  ): Promise<void> {
    if (options.skipOnChain) {
      this.logger.debug('Skipping on-chain adapter/arbiter validation (quoting mode)');
      return;
    }

    const contracts = this.configService.getContracts(chainId);

    try {
      // Get adapter address from router (on-chain, cached)
      const adapterAddr = await this.contractsService.getAdapter(chainId, router, type, selector);

      // Get arbiter address from adapter (on-chain, cached)
      const arbiterAddr = await this.contractsService.getArbiter(chainId, adapterAddr);

      // Validate adapter matches configuration
      const expectedAdapter = getAddress(contracts.ecoAdapter);
      const actualAdapter = getAddress(adapterAddr);

      if (!isAddressEqual(actualAdapter, expectedAdapter)) {
        throw new ValidationError(
          `Invalid adapter address for chain ${chainId}. Expected ${expectedAdapter}, got ${actualAdapter}`,
          ValidationErrorType.PERMANENT,
          'RhinestoneValidationService.validateAdapterAndArbiter',
        );
      }

      // Validate arbiter matches configuration
      const expectedArbiter = getAddress(contracts.ecoArbiter);
      const actualArbiter = getAddress(arbiterAddr);

      if (!isAddressEqual(actualArbiter, expectedArbiter)) {
        throw new ValidationError(
          `Invalid arbiter address. Expected ${expectedArbiter}, got ${actualArbiter}`,
          ValidationErrorType.PERMANENT,
          'RhinestoneValidationService.validateAdapterAndArbiter',
        );
      }

      this.logger.debug(`Adapter and arbiter validation passed for chain ${chainId}, type ${type}`);
    } catch (error) {
      // If error is already a ValidationError, re-throw it
      if (error instanceof ValidationError) {
        throw error;
      }

      // Otherwise, wrap it in a ValidationError
      throw new ValidationError(
        `Failed to validate adapter/arbiter: ${error instanceof Error ? error.message : String(error)}`,
        ValidationErrorType.TEMPORARY, // Network errors are temporary
        'RhinestoneValidationService.validateAdapterAndArbiter',
      );
    }
  }

  /**
   * Validate fill and claim intent hashes match
   * @param fillIntentHashes Array of intent hashes from fill
   * @param claimIntentHash Intent hash from claim
   * @throws {ValidationError} If claim hash is not in fill hashes
   */
  validateIntentHashMatch(fillIntentHashes: string[], claimIntentHash: string): void {
    if (!fillIntentHashes.includes(claimIntentHash)) {
      throw new ValidationError(
        'Intent hash for fill and claim do not match',
        ValidationErrorType.PERMANENT,
        'RhinestoneValidationService.validateIntentHashMatch',
      );
    }
  }

  /**
   * Validate decoded function name matches expected
   * @param functionName The decoded function name
   * @param expected The expected function name (routeFill or routeClaim)
   * @throws {ValidationError} If function name doesn't match
   */
  validateFunctionName(functionName: string, expected: 'routeFill' | 'routeClaim'): void {
    if (functionName !== expected) {
      throw new ValidationError(
        `Invalid router function. Expected ${expected}, got ${functionName}`,
        ValidationErrorType.PERMANENT,
        'RhinestoneValidationService.validateFunctionName',
      );
    }
  }

  /**
   * Validate at least one route call exists
   * @param callCount The number of route calls
   * @throws {ValidationError} If no route calls found
   */
  validateRouteCallCount(callCount: number): void {
    if (callCount === 0) {
      throw new ValidationError(
        'Invalid route call - No calls found',
        ValidationErrorType.PERMANENT,
        'RhinestoneValidationService.validateRouteCallCount',
      );
    }
  }

  /**
   * Validate call type is adapter call (not singleCall or multiCall)
   * @param type The decoded call type
   * @throws {ValidationError} If type is not 'adapterCall'
   */
  validateAdapterType(type: string): void {
    if (type !== 'adapterCall') {
      throw new ValidationError(
        `Call is not an adapter call. Got type: ${type}`,
        ValidationErrorType.PERMANENT,
        'RhinestoneValidationService.validateAdapterType',
      );
    }
  }

  /**
   * Validate order target chain matches intent destination
   * @param orderTargetChain The target chain ID from the order
   * @param intentDestination The destination from the intent
   * @throws {ValidationError} If chains don't match
   */
  validateChainIdConsistency(orderTargetChain: bigint, intentDestination: bigint): void {
    if (orderTargetChain !== intentDestination) {
      throw new ValidationError(
        `Intent destination (${intentDestination}) does not match order target chainID (${orderTargetChain})`,
        ValidationErrorType.PERMANENT,
        'RhinestoneValidationService.validateChainIdConsistency',
      );
    }
  }

  /**
   * Validate native token handling
   * Checks if native tokens are supported and if they match across chains
   *
   * @param intent The intent to validate
   * @throws {ValidationError} If native token validation fails
   */
  validateNativeToken(intent: Intent): void {
    // TODO: Check if config has isNativeETHSupported method
    // For now, we'll assume native tokens are not supported
    const isNativeSupported = false;

    const isNativeIntent = intent.route.nativeAmount > 0n;

    if (!isNativeSupported && (isNativeIntent || intent.reward.nativeAmount > 0n)) {
      throw new ValidationError(
        'Native token intents are not supported',
        ValidationErrorType.PERMANENT,
        'RhinestoneValidationService.validateNativeToken',
      );
    }

    // If native is supported and this is a native intent, validate chains match
    // TODO: Implement chain native token matching when native support is enabled
    // if (isNativeSupported && isNativeIntent) {
    //   const srcChainId = Number(intent.sourceChainId);
    //   const destChainId = Number(intent.destination);
    //
    //   const srcNative = getChainConfig(srcChainId).nativeCurrency.symbol;
    //   const destNative = getChainConfig(destChainId).nativeCurrency.symbol;
    //
    //   if (srcNative !== destNative) {
    //     throw new ValidationError(
    //       `Native tokens must match. Source: ${srcNative}, Destination: ${destNative}`,
    //       ValidationErrorType.PERMANENT,
    //       'RhinestoneValidationService.validateNativeToken',
    //     );
    //   }
    // }
  }

  /**
   * Validate route has exactly one call (v1 limitation)
   * @param intent The intent to validate
   * @throws {ValidationError} If route has multiple calls
   */
  validateSingleCall(intent: Intent): void {
    if (intent.route.calls.length !== 1) {
      throw new ValidationError(
        `Only single-call routes are supported. Found ${intent.route.calls.length} calls`,
        ValidationErrorType.PERMANENT,
        'RhinestoneValidationService.validateSingleCall',
      );
    }
  }

  // ========================================
  // Fee Validation & Calculation
  // ========================================

  /**
   * Calculate and validate fees for a Rhinestone intent
   * This method validates profitability and returns fee details
   *
   * @param intent The intent to calculate fees for
   * @param options Optional configuration
   * @param options.skipCalculation Skip calculation (for quoting)
   * @returns Fee details including base, percentage, and total fees
   * @throws {ValidationError} If route is not profitable or token configuration issues
   */
  async calculateAndValidateFees(
    intent: Intent,
    options: { skipCalculation?: boolean } = {},
  ): Promise<FeeDetails> {
    if (options.skipCalculation) {
      this.logger.debug('Skipping fee calculation (quoting mode)');
      return this.getEmptyFeeDetails();
    }

    // Validate route has tokens
    if (intent.route.tokens.length === 0) {
      throw new ValidationError(
        'No route tokens found for fee calculation',
        ValidationErrorType.PERMANENT,
        'RhinestoneValidationService.calculateAndValidateFees',
      );
    }

    // Validate reward has tokens
    if (intent.reward.tokens.length === 0) {
      throw new ValidationError(
        'No reward tokens found for fee calculation',
        ValidationErrorType.PERMANENT,
        'RhinestoneValidationService.calculateAndValidateFees',
      );
    }

    // Validate native amounts are zero (Rhinestone currently doesn't support native tokens)
    if (intent.route.nativeAmount > 0n || intent.reward.nativeAmount > 0n) {
      throw new ValidationError(
        'Native token amounts must be zero for Rhinestone fee calculation',
        ValidationErrorType.PERMANENT,
        'RhinestoneValidationService.calculateAndValidateFees',
      );
    }

    try {
      // Get the first route token address for fee config lookup
      const tokenAddress = intent.route.tokens[0].token;

      // Get fee configuration using the hierarchical resolver (token > network > fulfillment)
      const feeConfig = this.feeResolverService.resolveFee(intent.destination, tokenAddress);

      // Use shared fee calculation helper
      const feeResult = FeeCalculationHelper.calculateFees(
        intent,
        feeConfig,
        this.tokenConfigService,
      );

      // Validate profitability: route amount must not exceed maximum
      if (feeResult.routeTokens > feeResult.routeMaximumTokens) {
        throw new ValidationError(
          `Route is not profitable. Route tokens: ${feeResult.routeTokens}, Maximum allowed: ${feeResult.routeMaximumTokens}, Fee: ${feeResult.totalFee}`,
          ValidationErrorType.PERMANENT,
          'RhinestoneValidationService.calculateAndValidateFees',
        );
      }

      this.logger.debug(
        `Fee calculation complete: base=${feeResult.baseFee}, percentage=${feeResult.percentageFee}, total=${feeResult.totalFee}, profitable=${feeResult.routeTokens <= feeResult.routeMaximumTokens}`,
      );

      return {
        reward: {
          nativeAmount: feeResult.rewardNative,
          tokens: intent.reward.tokens.map((t) => ({ amount: t.amount, token: t })),
        },
        route: {
          nativeAmount: feeResult.routeNative,
          tokens: intent.route.tokens.map((t) => ({ amount: t.amount, token: t })),
          maximum: {
            nativeAmount: 0n, // Rhinestone doesn't support native tokens
            tokens: intent.route.tokens.map((t) => ({
              amount: feeResult.routeMaximumTokens,
              token: t,
            })),
          },
        },
        fee: {
          base: feeResult.baseFee,
          percentage: feeResult.percentageFee,
          total: feeResult.totalFee,
          bps: feeConfig.tokens.scalarBps,
        },
      };
    } catch (error) {
      // If error is already a ValidationError, re-throw it
      if (error instanceof ValidationError) {
        throw error;
      }

      // Wrap other errors as TEMPORARY (could be token config or network issues)
      throw new ValidationError(
        `Failed to calculate fees: ${error instanceof Error ? error.message : String(error)}`,
        ValidationErrorType.TEMPORARY,
        'RhinestoneValidationService.calculateAndValidateFees',
      );
    }
  }

  // ========================================
  // Helper Methods
  // ========================================

  /**
   * Get empty fee details (used for quoting or when calculation is skipped)
   */
  private getEmptyFeeDetails(): FeeDetails {
    return {
      reward: { nativeAmount: 0n, tokens: [] },
      route: { nativeAmount: 0n, tokens: [], maximum: { nativeAmount: 0n, tokens: [] } },
      fee: { base: 0n, percentage: 0n, total: 0n, bps: 0 },
    };
  }
}

/**
 * Fee calculation details returned by calculateAndValidateFees
 */
export interface FeeDetails {
  reward: {
    nativeAmount: bigint;
    tokens: Array<{ amount: bigint; token: any }>;
  };
  route: {
    nativeAmount: bigint;
    tokens: Array<{ amount: bigint; token: any }>;
    maximum: {
      nativeAmount: bigint;
      tokens: Array<{ amount: bigint; token: any }>;
    };
  };
  fee: {
    base: bigint;
    percentage: bigint;
    total: bigint;
    bps: number;
  };
}
