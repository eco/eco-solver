import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';

import { Validation } from './validation.interface';

@Injectable()
export class NativeFeeValidation implements Validation {
  constructor(private readonly fulfillmentConfigService: FulfillmentConfigService) {}

  async validate(intent: Intent): Promise<boolean> {
    // Calculate total value from native values in calls
    const nativeValue = intent.route.calls.reduce((sum, call) => sum + call.value, 0n);

    // Get reward from the new structure
    const reward = intent.reward.nativeValue;

    // Native intents have different fee requirements
    // Calculate required fee: nativeBaseFee + (totalValue * nativePercentageFee / 10000)
    const nativeFeeConfig = this.fulfillmentConfigService.nativeFee;
    const nativeBaseFee = nativeFeeConfig?.baseFee ?? BigInt(0);

    const base = 1_000;
    const nativePercentageFee = BigInt(Math.floor((nativeFeeConfig?.bpsFee ?? 0) * base));

    const percentageFee = (nativeValue * nativePercentageFee) / BigInt(base * 10000);
    const totalRequiredFee = nativeBaseFee + percentageFee;

    if (reward < totalRequiredFee) {
      throw new Error(
        `Reward ${reward} is less than required native fee ${totalRequiredFee} (base: ${nativeBaseFee}, percentage: ${percentageFee})`,
      );
    }

    return true;
  }
}
