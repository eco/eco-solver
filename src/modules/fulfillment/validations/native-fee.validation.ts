import { Injectable } from '@nestjs/common';
import { Intent } from '@/modules/intents/interfaces/intent.interface';
import { Validation } from './validation.interface';

@Injectable()
export class NativeFeeValidation implements Validation {
  // TODO: Inject configuration service for native fee parameters
  private nativeBaseFee = BigInt(2000000); // 0.002 ETH in wei as example
  private nativePercentageFee = BigInt(75); // 0.75% as basis points

  async validate(intent: Intent): Promise<boolean> {
    const amount = BigInt(intent.value);
    const reward = BigInt(intent.reward);
    
    // Native intents have different fee requirements
    // Calculate required fee: nativeBaseFee + (amount * nativePercentageFee / 10000)
    const percentageFee = (amount * this.nativePercentageFee) / BigInt(10000);
    const totalRequiredFee = this.nativeBaseFee + percentageFee;
    
    if (reward < totalRequiredFee) {
      throw new Error(`Reward ${reward} is less than required native fee ${totalRequiredFee} (base: ${this.nativeBaseFee}, percentage: ${percentageFee})`);
    }

    return true;
  }
}