import { Injectable } from '@nestjs/common';
import { Intent } from '@/modules/intents/interfaces/intent.interface';
import { Validation } from './validation.interface';

@Injectable()
export class StandardFeeValidation implements Validation {
  // TODO: Inject configuration service for fee parameters
  private baseFee = BigInt(1000000); // 0.001 ETH in wei as example
  private scalarFee = BigInt(100); // 1% as basis points

  async validate(intent: Intent): Promise<boolean> {
    const amount = BigInt(intent.value);
    const reward = BigInt(intent.reward);
    
    // Calculate required fee: baseFee + (amount * scalarFee / 10000)
    const scaledFee = (amount * this.scalarFee) / BigInt(10000);
    const totalRequiredFee = this.baseFee + scaledFee;
    
    if (reward < totalRequiredFee) {
      throw new Error(`Reward ${reward} is less than required fee ${totalRequiredFee} (base: ${this.baseFee}, scalar: ${scaledFee})`);
    }

    return true;
  }
}