import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';

import { Validation } from './validation.interface';

@Injectable()
export class StandardFeeValidation implements Validation {
  constructor(private evmConfigService: EvmConfigService) {}

  async validate(intent: Intent): Promise<boolean> {
    // Get fee logic for the destination chain
    const feeLogic = this.evmConfigService.getFeeLogic(Number(intent.route.destination));
    const baseFee = BigInt(feeLogic.baseFlatFee);
    const scalarBps = BigInt(feeLogic.scalarBps);

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

    // Calculate required fee: baseFee + (totalValue * scalarBps / 10000)
    const scaledFee = (totalValue * scalarBps) / 10000n;
    const totalRequiredFee = baseFee + scaledFee;

    // Check if reward native value covers the fee
    if (intent.reward.nativeValue < totalRequiredFee) {
      throw new Error(
        `Reward native value ${intent.reward.nativeValue} is less than required fee ${totalRequiredFee} (base: ${baseFee}, scalar: ${scaledFee})`,
      );
    }

    return true;
  }
}
