import { Injectable } from '@nestjs/common';
import { Intent } from '@/common/interfaces/intent.interface';
import { Validation } from './validation.interface';

@Injectable()
export class StandardFeeValidation implements Validation {
  // TODO: Inject configuration service for fee parameters
  private baseFee = 1000000n; // 0.001 ETH in wei as example
  private scalarFee = 100n; // 1% as basis points

  async validate(intent: Intent): Promise<boolean> {
    // Calculate total value being transferred
    let totalValue = 0n;
    
    // Add token values
    if (intent.route.tokens && intent.route.tokens.length > 0) {
      for (const token of intent.route.tokens) {
        totalValue += token.amount;
      }
    }
    
    // Add call values
    if (intent.route.calls && intent.route.calls.length > 0) {
      for (const call of intent.route.calls) {
        totalValue += call.value;
      }
    }
    
    // Use native value as a fallback if no other value
    if (totalValue === 0n && intent.reward.nativeValue) {
      totalValue = intent.reward.nativeValue;
    }
    
    // Calculate required fee: baseFee + (totalValue * scalarFee / 10000)
    const scaledFee = (totalValue * this.scalarFee) / 10000n;
    const totalRequiredFee = this.baseFee + scaledFee;
    
    // Check if reward native value covers the fee
    if (intent.reward.nativeValue < totalRequiredFee) {
      throw new Error(`Reward native value ${intent.reward.nativeValue} is less than required fee ${totalRequiredFee} (base: ${this.baseFee}, scalar: ${scaledFee})`);
    }

    return true;
  }
}