import { Injectable } from '@nestjs/common';

import {
  BaseFulfillment,
  FulfillmentResult,
} from '@/common/abstractions/base-fulfillment.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';

@Injectable()
export class StorageFulfillment extends BaseFulfillment {
  constructor(private evmConfigService: EvmConfigService) {
    super();
  }

  async canFulfill(intent: Intent): Promise<FulfillmentResult> {
    try {
      // Check if we support the target chain
      const supportedChains = this.getSupportedChains();
      if (!supportedChains.includes(intent.targetChainId)) {
        return {
          shouldExecute: false,
          reason: `Target chain ${intent.targetChainId} not supported`,
        };
      }

      // Check if we have sufficient balance
      const hasBalance = await this.checkBalance(intent);
      if (!hasBalance) {
        return {
          shouldExecute: false,
          reason: 'Insufficient balance for fulfillment',
        };
      }

      return {
        shouldExecute: true,
      };
    } catch (error) {
      return {
        shouldExecute: false,
        reason: `Error checking fulfillment: ${error.message}`,
      };
    }
  }

  async prepareFulfillmentData(intent: Intent): Promise<any> {
    // Prepare data specific to storage fulfillment
    return {
      intentId: intent.intentId,
      target: intent.target,
      data: intent.data,
      value: intent.value,
    };
  }

  private getSupportedChains(): (string | number)[] {
    return [this.evmConfigService.chainId, 'solana-mainnet'];
  }

  private async checkBalance(intent: Intent): Promise<boolean> {
    // Simplified balance check
    // In production, this would check actual on-chain balances
    const requiredAmount = BigInt(intent.value) + BigInt(intent.reward);
    return requiredAmount > 0n; // Placeholder
  }
}
