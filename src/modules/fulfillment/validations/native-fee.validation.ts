import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { FeeResolverService } from '@/modules/config/services/fee-resolver.service';
import { ValidationErrorType } from '@/modules/fulfillment/enums/validation-error-type.enum';
import { ValidationError } from '@/modules/fulfillment/errors/validation.error';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { FeeCalculationValidation, FeeDetails } from './fee-calculation.interface';

@Injectable()
export class NativeFeeValidation implements FeeCalculationValidation {
  constructor(
    private readonly feeResolverService: FeeResolverService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  async validate(intent: Intent, context: ValidationContext): Promise<boolean> {
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('validation.NativeFeeValidation', {
        attributes: {
          'validation.name': 'NativeFeeValidation',
          'intent.hash': intent.intentHash,
          'intent.destination_chain': intent.destination?.toString(),
        },
      });

    try {
      // Native fee validation should only apply to intents with pure native rewards
      if (intent.reward.tokens && intent.reward.tokens.length > 0) {
        span.setAttributes({
          'validation.failed': true,
          'validation.reason': 'reward_tokens_present',
          'reward.tokens.count': intent.reward.tokens.length,
        });
        throw new ValidationError(
          'Native fee validation only applies to intents with pure native rewards, but reward tokens are present',
          ValidationErrorType.PERMANENT,
          'NativeFeeValidation',
        );
      }

      const feeDetails = await this.calculateFee(intent, context);

      span.setAttributes({
        'fee.base': feeDetails.fee.base.toString(),
        'fee.percentage': feeDetails.fee.percentage.toString(),
        'fee.total': feeDetails.fee.total.toString(),
        'reward.native': feeDetails.reward.native.toString(),
        'route.native': feeDetails.route.native.toString(),
        'route.maximum.native': feeDetails.route.maximum.native.toString(),
      });

      // For native transfers, check if reward native covers route native
      if (feeDetails.route.native > feeDetails.route.maximum.native) {
        throw new ValidationError(
          `Native route ${feeDetails.route.native} exceeds the maximum amount ${feeDetails.route.maximum.native}`,
          ValidationErrorType.PERMANENT,
          'NativeFeeValidation',
        );
      }

      if (!activeSpan) {
        span.setStatus({ code: api.SpanStatusCode.OK });
      }
      return true;
    } catch (error) {
      if (!activeSpan) {
        span.recordException(error as Error);
        span.setStatus({ code: api.SpanStatusCode.ERROR });
      }
      throw error;
    } finally {
      if (!activeSpan) {
        span.end();
      }
    }
  }

  async calculateFee(intent: Intent, _context: ValidationContext): Promise<FeeDetails> {
    // Calculate total value from native values in calls
    const routeNativeAmount = intent.route.calls.reduce((sum, call) => sum + call.value, 0n);

    // Get reward values
    const rewardNative = intent.reward.nativeAmount;
    const rewardTokens = 0n; // Native fee validation is for pure native transfers

    // Get fee configuration using hierarchical resolver (for native transfers, only network and default fees apply)
    const feeConfig = this.feeResolverService.resolveNativeFee(intent.destination);
    if (!feeConfig.native) {
      throw new ValidationError(`Native fee config not found for chain ${intent.destination}`);
    }

    const baseFee = BigInt(feeConfig.native.flatFee);

    // Calculate percentage fee from native reward amount
    const base = 1_000;
    const nativePercentageFeeScalar = BigInt(Math.floor(feeConfig.native.scalarBps * base));
    const percentageFee = (rewardNative * nativePercentageFeeScalar) / BigInt(base * 10000);
    const totalFee = baseFee + percentageFee;

    // Calculate route maximum (reward.native - total fee for native, 0 for tokens in native fee)
    const routeMaximumNative = rewardNative > totalFee ? rewardNative - totalFee : 0n;
    const routeMaximumTokens = 0n; // Native fee validation is for native transfers

    return {
      reward: {
        native: rewardNative,
        tokens: rewardTokens,
      },
      route: {
        native: routeNativeAmount,
        tokens: 0n, // Native fee validation is for native transfers
        maximum: {
          native: routeMaximumNative,
          tokens: routeMaximumTokens,
        },
      },
      fee: {
        base: baseFee,
        percentage: percentageFee,
        total: totalFee,
        bps: feeConfig.native.scalarBps,
      },
    };
  }
}
