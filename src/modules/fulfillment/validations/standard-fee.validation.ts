import { Injectable } from '@nestjs/common';

import { Address } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { normalize } from '@/common/tokens/normalize';
import { EvmConfigService } from '@/modules/config/services';

import { Validation } from './validation.interface';

@Injectable()
export class StandardFeeValidation implements Validation {
  constructor(private evmConfigService: EvmConfigService) {}

  async validate(intent: Intent): Promise<boolean> {
    // Get fee logic for the destination chain
    const feeLogic = this.evmConfigService.getFeeLogic(Number(intent.route.destination));
    const baseFee = BigInt(feeLogic.baseFlatFee);

    // Calculate total value being transferred
    const totalReward = this.sum(intent.route.source, intent.reward.tokens);
    const totalValue = this.sum(intent.route.destination, intent.route.tokens);

    // Calculate required fee: baseFee + (totalValue * scalarBps / 10000)
    const base = 10000;
    const scalarBpsInt = BigInt(Math.floor(feeLogic.scalarBps * base));
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

  private sum(chainId: bigint, tokens: Readonly<{ amount: bigint; token: Address }[]>): bigint {
    return tokens.reduce((acc, token) => {
      const { decimals } = this.evmConfigService.getTokenConfig(Number(chainId), token.token);
      return acc + normalize(token.amount, decimals);
    }, 0n);
  }
}
