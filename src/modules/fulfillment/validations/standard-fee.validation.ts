import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { parseUnits } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { normalize } from '@/common/tokens/normalize';
import { sum } from '@/common/utils/math';
import { BlockchainConfigService, FulfillmentConfigService } from '@/modules/config/services';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { FeeCalculationValidation, FeeDetails } from './fee-calculation.interface';

@Injectable()
export class StandardFeeValidation implements FeeCalculationValidation {
  constructor(
    private blockchainConfigService: BlockchainConfigService,
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
          'intent.source_chain': intent.sourceChainId?.toString(),
          'intent.destination_chain': intent.destination?.toString(),
        },
      });

    if (context.quoting) {
      // Skip validation when is quoting
      span.setAttribute('validation.skipped', true);
      span.setAttribute('validation.quoting', true);
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
          `Reward amount ${feeDetails.currentReward} is less than required fee ${feeDetails.totalRequiredFee} (base: ${feeDetails.baseFee}, scalar: ${feeDetails.percentageFee})`,
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
    const fee = this.blockchainConfigService.getFeeLogic(intent.destination);
    const baseFee = normalize(parseUnits(fee.tokens.flatFee.toString(), 18), 18);

    // Calculate total value being transferred
    const totalReward = sum(
      this.fulfillmentConfigService.normalize(intent.sourceChainId, intent.reward.tokens),
      'amount',
    );
    const totalValue = sum(
      this.fulfillmentConfigService.normalize(intent.destination, intent.route.tokens),
      'amount',
    );

    // Calculate the required fee: baseFee + (totalValue * scalarBps / 10000)
    // Note: totalValue should NOT be added to the fee - it's the transfer amount, not a fee
    const base = 10_000;
    const scalarBpsInt = BigInt(Math.floor(fee.tokens.scalarBps * base));
    const percentageFee = (totalValue * scalarBpsInt) / BigInt(base * 10000);
    const totalRequiredFee = totalValue + baseFee + percentageFee;

    return {
      baseFee,
      percentageFee,
      totalRequiredFee,
      currentReward: totalReward,
      minimumRequiredReward: totalRequiredFee,
    };
  }
}
