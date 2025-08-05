import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { FulfillmentStrategy } from '@/modules/fulfillment/strategies';

import { Validation } from './validation.interface';

@Injectable()
export class ExecutorBalanceValidation implements Validation {
  constructor(
    private readonly blockchainExecutorService: BlockchainExecutorService,
    private readonly blockchainReaderService: BlockchainReaderService,
  ) {}

  async validate(intent: Intent, fulfillmentStrategy: FulfillmentStrategy): Promise<boolean> {
    // This should verify that the executor has enough funds to execute the fulfillment
    // on the destination chain

    const fulfillerWalletId = await fulfillmentStrategy.getWalletId(intent);

    const chainID = intent.route.destination;
    const executor = this.blockchainExecutorService.getExecutorForChain(chainID);
    const executorAddr = await executor.getWalletAddress(fulfillerWalletId, chainID);

    const checkRequests = intent.route.tokens.map(async ({ token, amount }) => {
      const balance = await this.blockchainReaderService.getTokenBalance(
        chainID,
        token,
        executorAddr,
      );

      return { enough: balance >= amount, token };
    });

    const checks = await Promise.all(checkRequests);

    const notEnough = checks.filter((check) => !check.enough);

    if (notEnough.length) {
      const tokens = notEnough.map(({ token }) => token);
      throw new Error(`Not enough token balance found for: ${tokens.join(', ')}`);
    }

    return true;
  }
}
