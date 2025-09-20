import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { parseUnits } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { normalize } from '@/common/tokens/normalize';
import { sum } from '@/common/utils/math';
import { FeeResolverService } from '@/modules/config/services/fee-resolver.service';
import { TokenConfigService } from '@/modules/config/services/token-config.service';
import { ValidationErrorType } from '@/modules/fulfillment/enums/validation-error-type.enum';
import { ValidationError } from '@/modules/fulfillment/errors/validation.error';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { FeeCalculationValidation, FeeDetails } from './fee-calculation.interface';

@Injectable()
export class StandardFeeValidation implements FeeCalculationValidation {
  constructor(
    private readonly feeResolverService: FeeResolverService,
    private readonly tokenConfigService: TokenConfigService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  async validate(intent: Intent, context: ValidationContext): Promise<boolean> {
    const span = api.trace.getActiveSpan();

    span?.setAttributes({
      'validation.name': 'StandardFeeValidation',
      'intent.hash': intent.intentHash,
      'intent.source_chain': intent.sourceChainId?.toString(),
      'intent.destination_chain': intent.destination?.toString(),
    });

    if (context.quoting) {
      // Skip validation when is quoting
      span?.setAttribute('validation.skipped', true);
      span?.setAttribute('validation.quoting', true);
      return true;
    }

    try {
      if (intent.route.nativeAmount > 0n) {
        throw new Error(`Route native amount must be zero`);
      }

      // Standard fee validation requires both route tokens and reward tokens
      if (!intent.route.tokens.length) {
        throw new Error('No route tokens found');
      }

      if (!intent.reward.tokens.length) {
        throw new Error('No reward tokens found');
      }

      const feeDetails = await this.calculateFee(intent, context);

      span?.setAttributes({
        'fee.base': feeDetails.fee.base.toString(),
        'fee.percentage': feeDetails.fee.percentage.toString(),
        'fee.total': feeDetails.fee.total.toString(),
        'reward.tokens': feeDetails.reward.tokens.toString(),
        'route.tokens': feeDetails.route.tokens.toString(),
        'route.maximum.tokens': feeDetails.route.maximum.tokens.toString(),
      });

      // Check if the reward tokens cover the route tokens and fees
      if (feeDetails.route.tokens > feeDetails.route.maximum.tokens) {
        throw new ValidationError(
          `Route amount ${feeDetails.route.tokens} exceeds maximum ${feeDetails.route.maximum.tokens}`,
          ValidationErrorType.PERMANENT,
          StandardFeeValidation.name,
        );
      }

      span?.setStatus({ code: api.SpanStatusCode.OK });
      return true;
    } catch (error) {
      span?.recordException(error as Error);
      span?.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    }
  }

  async calculateFee(intent: Intent, _context: ValidationContext): Promise<FeeDetails> {
    // Ensure there's exactly one token in the route
    if (intent.route.tokens.length > 1) {
      throw new ValidationError(
        `Standard fee validation only supports single token routes, but found ${intent.route.tokens.length} tokens`,
        ValidationErrorType.PERMANENT,
        StandardFeeValidation.name,
      );
    }
    if (intent.route.tokens.length === 0) {
      throw new ValidationError(
        `Standard fee validation required a route token`,
        ValidationErrorType.PERMANENT,
        StandardFeeValidation.name,
      );
    }

    // Get the single token address from the route
    const tokenAddress = intent.route.tokens[0].token;

    // Get fee logic using the hierarchical resolver (token > network > fulfillment)
    const feeConfig = this.feeResolverService.resolveFee(intent.destination, tokenAddress);
    const baseFee = normalize(parseUnits(feeConfig.tokens.flatFee.toString(), 18), 18);

    // Calculate reward values
    const rewardTokens = sum(
      this.tokenConfigService.normalize(intent.sourceChainId, intent.reward.tokens),
      'amount',
    );
    const rewardNative = intent.reward.nativeAmount;

    // Calculate route values
    const routeTokens = sum(
      this.tokenConfigService.normalize(intent.destination, intent.route.tokens),
      'amount',
    );
    const routeNative = intent.route.nativeAmount;

    // Calculate percentage fee from reward tokens (for token transfers)
    const base = 10_000;
    const scalarBpsInt = BigInt(Math.floor(feeConfig.tokens.scalarBps * base));
    const percentageFee = (rewardTokens * scalarBpsInt) / BigInt(base * 10000);
    const totalFee = baseFee + percentageFee;

    // Calculate route maximum (reward.tokens - total fee for tokens, 0 for native in standard fee)
    const routeMaximumTokens = rewardTokens > totalFee ? rewardTokens - totalFee : 0n;
    const routeMaximumNative = 0n; // Standard fee validation is for token transfers

    return {
      reward: {
        native: rewardNative,
        tokens: rewardTokens,
      },
      route: {
        native: routeNative,
        tokens: routeTokens,
        maximum: {
          native: routeMaximumNative,
          tokens: routeMaximumTokens,
        },
      },
      fee: {
        base: baseFee,
        percentage: percentageFee,
        total: totalFee,
        bps: feeConfig.tokens.scalarBps,
      },
    };
  }
}
