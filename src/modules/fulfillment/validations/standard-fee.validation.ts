import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { sum } from '@/common/utils/math';
import { EvmConfigService, FulfillmentConfigService } from '@/modules/config/services';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { FeeCalculationValidation, FeeDetails } from './fee-calculation.interface';

@Injectable()
export class StandardFeeValidation implements FeeCalculationValidation {
  constructor(
    private evmConfigService: EvmConfigService,
    private fulfillmentConfigService: FulfillmentConfigService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  async validate(intent: Intent, context: ValidationContext): Promise<boolean> {
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('validation.StandardFeeValidation', {
        attributes: {
          'validation.name': 'StandardFeeValidation',
          'intent.hash': intent.intentHash,
          'intent.source_chain': intent.route.source?.toString(),
          'intent.destination_chain': intent.route.destination?.toString(),
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

      // Check if the reward covers the fee
      if (feeDetails.currentReward < feeDetails.totalRequiredFee) {
        throw new Error(
          `Reward native value ${feeDetails.currentReward} is less than required fee ${feeDetails.totalRequiredFee} (base: ${feeDetails.baseFee}, scalar: ${feeDetails.percentageFee})`,
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
    // Get fee logic for the destination chain
    const fee = this.evmConfigService.getFeeLogic(Number(intent.route.destination));
    const baseFee = BigInt(fee.tokens.flatFee ?? 0);

    // Calculate total value being transferred
    const totalReward = sum(
      this.fulfillmentConfigService.normalize(intent.route.source, intent.reward.tokens),
      'amount',
    );
    const totalValue = sum(
      this.fulfillmentConfigService.normalize(intent.route.destination, intent.route.tokens),
      'amount',
    );

    // Calculate required fee: baseFee + (totalValue * scalarBps / 10000)
    const base = 10000;
    const scalarBpsInt = BigInt(Math.floor(fee.tokens.scalarBps * base));
    const percentageFee = (totalValue * scalarBpsInt) / BigInt(base * 10000);
    const totalRequiredFee = baseFee + percentageFee;

    return {
      baseFee,
      percentageFee,
      totalRequiredFee,
      currentReward: totalReward,
      minimumRequiredReward: totalRequiredFee,
    };
  }
}
