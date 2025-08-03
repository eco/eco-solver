import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';

import { Validation } from './validation.interface';

@Injectable()
export class NativeFeeValidation implements Validation {
  // TODO: Inject configuration service for native fee parameters
  private nativeBaseFee = BigInt(2000000); // 0.002 ETH in wei as example
  private nativePercentageFee = BigInt(75); // 0.75% as basis points

  async validate(intent: Intent): Promise<boolean> {
    // Calculate total value from tokens and native value in calls
    const tokenValue = intent.route.tokens.reduce((sum, token) => sum + token.amount, BigInt(0));
    const nativeValue = intent.route.calls.reduce((sum, call) => sum + call.value, BigInt(0));
    const totalValue = tokenValue + nativeValue;

    // Get reward from the new structure
    const reward = intent.reward.nativeValue;

    // Native intents have different fee requirements
    // Calculate required fee: nativeBaseFee + (totalValue * nativePercentageFee / 10000)
    const percentageFee = (totalValue * this.nativePercentageFee) / BigInt(10000);
    const totalRequiredFee = this.nativeBaseFee + percentageFee;

    if (reward < totalRequiredFee) {
      throw new Error(
        `Reward ${reward} is less than required native fee ${totalRequiredFee} (base: ${this.nativeBaseFee}, percentage: ${percentageFee})`,
      );
    }

    return true;
  }
}
