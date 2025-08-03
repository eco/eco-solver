import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';

import { Validation } from './validation.interface';

@Injectable()
export class CrowdLiquidityFeeValidation implements Validation {
  // TODO: Inject configuration service for CL-specific fee parameters
  private clBaseFee = BigInt(500000); // 0.0005 ETH in wei as example
  private clPercentageFee = BigInt(50); // 0.5% as basis points

  async validate(intent: Intent): Promise<boolean> {
    // Calculate total value from tokens and native value in calls
    const tokenValue = intent.route.tokens.reduce((sum, token) => sum + token.amount, BigInt(0));
    const nativeValue = intent.route.calls.reduce((sum, call) => sum + call.value, BigInt(0));
    const totalValue = tokenValue + nativeValue;

    // Get reward from the new structure
    const reward = intent.reward.nativeValue;

    // Crowd liquidity uses different fee structure
    // Calculate required fee: clBaseFee + (totalValue * clPercentageFee / 10000)
    const percentageFee = (totalValue * this.clPercentageFee) / BigInt(10000);
    const totalRequiredFee = this.clBaseFee + percentageFee;

    if (reward < totalRequiredFee) {
      throw new Error(
        `Reward ${reward} is less than required CL fee ${totalRequiredFee} (base: ${this.clBaseFee}, percentage: ${percentageFee})`,
      );
    }

    return true;
  }
}
