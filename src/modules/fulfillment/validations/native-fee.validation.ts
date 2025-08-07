import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';

import { FeeCalculationValidation, FeeDetails } from './fee-calculation.interface';

@Injectable()
export class NativeFeeValidation implements FeeCalculationValidation {
  constructor(private readonly fulfillmentConfigService: FulfillmentConfigService) {}

  async validate(intent: Intent, context: ValidationContext): Promise<boolean> {
    const feeDetails = await this.calculateFee(intent, context);

    if (feeDetails.currentReward < feeDetails.totalRequiredFee) {
      throw new Error(
        `Reward ${feeDetails.currentReward} is less than required native fee ${feeDetails.totalRequiredFee} (base: ${feeDetails.baseFee}, percentage: ${feeDetails.percentageFee})`,
      );
    }

    return true;
  }

  async calculateFee(intent: Intent, _context: ValidationContext): Promise<FeeDetails> {
    // Calculate total value from native values in calls
    const nativeValue = intent.route.calls.reduce((sum, call) => sum + call.value, 0n);

    // Get reward from the new structure
    const reward = intent.reward.nativeValue;

    // Native intents have different fee requirements
    const nativeFeeConfig = this.fulfillmentConfigService.getNetworkFee(intent.route.destination);
    const baseFee = BigInt(nativeFeeConfig.native.flatFee ?? 0);

    const base = 1_000;
    const nativePercentageFeeScalar = BigInt(Math.floor((nativeFeeConfig.native.scalarBps ?? 0) * base));

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
