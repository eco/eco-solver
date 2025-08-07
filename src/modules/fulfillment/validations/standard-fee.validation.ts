import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { sum } from '@/common/utils/math';
import { EvmConfigService, FulfillmentConfigService } from '@/modules/config/services';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';

import { FeeCalculationValidation, FeeDetails } from './fee-calculation.interface';

@Injectable()
export class StandardFeeValidation implements FeeCalculationValidation {
  constructor(
    private evmConfigService: EvmConfigService,
    private fulfillmentConfigService: FulfillmentConfigService,
  ) {}

  async validate(intent: Intent, context: ValidationContext): Promise<boolean> {
    const feeDetails = await this.calculateFee(intent, context);

    // Check if the reward covers the fee
    if (feeDetails.currentReward < feeDetails.totalRequiredFee) {
      throw new Error(
        `Reward native value ${feeDetails.currentReward} is less than required fee ${feeDetails.totalRequiredFee} (base: ${feeDetails.baseFee}, scalar: ${feeDetails.percentageFee})`,
      );
    }

    return true;
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
