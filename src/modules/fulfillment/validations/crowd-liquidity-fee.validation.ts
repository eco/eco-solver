import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';

import { Validation } from './validation.interface';

@Injectable()
export class CrowdLiquidityFeeValidation implements Validation {
  constructor(private readonly fulfillmentConfigService: FulfillmentConfigService) {}

  async validate(intent: Intent): Promise<boolean> {
    // Calculate total value from tokens and native value in calls
    const tokenValue = intent.route.tokens.reduce((sum, token) => sum + token.amount, BigInt(0));
    const nativeValue = intent.route.calls.reduce((sum, call) => sum + call.value, BigInt(0));
    const totalValue = tokenValue + nativeValue;

    // Get reward from the new structure
    const reward = intent.reward.nativeValue;

    // Crowd liquidity uses different fee structure
    // Calculate required fee: clBaseFee + (totalValue * clBpsFee / 10000)
    const clFeeConfig = this.fulfillmentConfigService.crowdLiquidityFee;
    const clBaseFee = clFeeConfig?.baseFee ?? BigInt(500000);
    const clBpsFee = clFeeConfig?.bpsFee ?? BigInt(50);

    const percentageFee = (totalValue * clBpsFee) / BigInt(10000);
    const totalRequiredFee = clBaseFee + percentageFee;

    if (reward < totalRequiredFee) {
      throw new Error(
        `Reward ${reward} is less than required CL fee ${totalRequiredFee} (base: ${clBaseFee}, percentage: ${percentageFee})`,
      );
    }

    return true;
  }
}
