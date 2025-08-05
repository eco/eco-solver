import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { sum } from '@/common/utils/math';
import { EvmConfigService, FulfillmentConfigService } from '@/modules/config/services';

import { Validation } from './validation.interface';

@Injectable()
export class StandardFeeValidation implements Validation {
  constructor(
    private evmConfigService: EvmConfigService,
    private fulfillmentConfigService: FulfillmentConfigService,
  ) {}

  async validate(intent: Intent, _context: ValidationContext): Promise<boolean> {
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
    const scaledFee = (totalValue * scalarBpsInt) / BigInt(base * 10000);
    const totalRequiredFee = baseFee + scaledFee;

    // Check if the reward native value covers the fee
    if (totalReward < totalRequiredFee) {
      throw new Error(
        `Reward native value ${totalReward} is less than required fee ${totalRequiredFee} (base: ${baseFee}, scalar: ${scaledFee})`,
      );
    }

    return true;
  }
}
