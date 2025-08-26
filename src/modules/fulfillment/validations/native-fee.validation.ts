import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { FeeCalculationValidation, FeeDetails } from './fee-calculation.interface';

@Injectable()
export class NativeFeeValidation implements FeeCalculationValidation {
  constructor(
    private readonly fulfillmentConfigService: FulfillmentConfigService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  async validate(intent: Intent, context: ValidationContext): Promise<boolean> {
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('validation.NativeFeeValidation', {
        attributes: {
          'validation.name': 'NativeFeeValidation',
          'intent.hash': intent.intentId,
          'intent.destination_chain': intent.destination?.toString(),
        },
      });

    try {
      const feeDetails = await this.calculateFee(intent, context);

      span.setAttributes({
        'fee.base': feeDetails.baseFee.toString(),
        'fee.percentage': feeDetails.percentageFee.toString(),
        'fee.total_required': feeDetails.totalRequiredFee.toString(),
        'fee.current_reward': feeDetails.currentReward.toString(),
        'fee.sufficient': feeDetails.currentReward >= feeDetails.totalRequiredFee,
      });

      if (feeDetails.currentReward < feeDetails.totalRequiredFee) {
        throw new Error(
          `Reward ${feeDetails.currentReward} is less than required native fee ${feeDetails.totalRequiredFee} (base: ${feeDetails.baseFee}, percentage: ${feeDetails.percentageFee})`,
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
    const nativeValue = intent.route.calls.reduce((sum, call) => sum + call.value, 0n);

    // Get reward from the new structure
    const reward = intent.reward.nativeAmount;

    // Native intents have different fee requirements
    const nativeFeeConfig = this.fulfillmentConfigService.getNetworkFee(intent.destination);
    const baseFee = BigInt(nativeFeeConfig.native.flatFee ?? 0);

    const base = 1_000;
    const nativePercentageFeeScalar = BigInt(
      Math.floor((nativeFeeConfig.native.scalarBps ?? 0) * base),
    );

    const percentageFee = (nativeValue * nativePercentageFeeScalar) / BigInt(base * 10000);
    const totalRequiredFee = baseFee + percentageFee;

    return {
      baseFee,
      percentageFee,
      totalRequiredFee,
      currentReward: reward,
      minimumRequiredReward: totalRequiredFee,
    };
  }
}
