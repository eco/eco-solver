import { Injectable } from '@nestjs/common';
import { Intent } from '@/modules/intents/interfaces/intent.interface';
import { Validation } from './validation.interface';

@Injectable()
export class CrowdLiquidityFeeValidation implements Validation {
  // TODO: Inject configuration service for CL-specific fee parameters
  private clBaseFee = BigInt(500000); // 0.0005 ETH in wei as example
  private clPercentageFee = BigInt(50); // 0.5% as basis points

  async validate(intent: Intent): Promise<boolean> {
    const amount = BigInt(intent.value);
    const reward = BigInt(intent.reward);
    
    // Crowd liquidity uses different fee structure
    // Calculate required fee: clBaseFee + (amount * clPercentageFee / 10000)
    const percentageFee = (amount * this.clPercentageFee) / BigInt(10000);
    const totalRequiredFee = this.clBaseFee + percentageFee;
    
    if (reward < totalRequiredFee) {
      throw new Error(`Reward ${reward} is less than required CL fee ${totalRequiredFee} (base: ${this.clBaseFee}, percentage: ${percentageFee})`);
    }

    return true;
  }
}