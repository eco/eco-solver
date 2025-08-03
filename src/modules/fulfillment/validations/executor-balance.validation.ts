import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainService } from '@/modules/blockchain/blockchain.service';

import { Validation } from './validation.interface';

@Injectable()
export class ExecutorBalanceValidation implements Validation {
  constructor(private readonly blockchainService: BlockchainService) {}

  async validate(intent: Intent): Promise<boolean> {
    // TODO: Implement executor balance check
    // This should verify that the executor has enough funds to execute the fulfillment
    // on the destination chain

    const destinationChainId = Number(intent.route.destination);

    // Calculate total required amount
    let totalRequired = 0n;

    // Add native value if any
    if (intent.reward.nativeValue) {
      totalRequired += intent.reward.nativeValue;
    }

    // Add call values
    if (intent.route.calls && intent.route.calls.length > 0) {
      for (const call of intent.route.calls) {
        totalRequired += call.value;
      }
    }

    // TODO: Add gas estimation
    // const estimatedGas = await this.blockchainService.estimateGas(intent);
    // totalRequired += estimatedGas;

    // TODO: Get executor address for destination chain
    // TODO: Get executor balance on destination chain
    // TODO: Compare balance with required amount + gas fees

    // For now, we'll add a placeholder
    // The actual implementation needs to:
    // 1. Determine which executor will be used (EVM, SVM, or Crowd Liquidity)
    // 2. Get the executor's address on the destination chain
    // 3. Check the executor's balance (native + tokens)
    // 4. Ensure balance > totalRequired + estimatedGasFees

    return true;
  }
}
