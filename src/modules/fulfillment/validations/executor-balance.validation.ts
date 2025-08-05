import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';

import { Validation } from './validation.interface';

@Injectable()
export class ExecutorBalanceValidation implements Validation {
  constructor(private readonly blockchainReaderService: BlockchainReaderService) {}

  async validate(intent: Intent, context: ValidationContext): Promise<boolean> {
    // This should verify that the executor has enough funds to execute the fulfillment
    // on the destination chain

    const chainID = intent.route.destination;
    const executorAddr = await context.getWalletAddress(chainID);

    const checkRequests = intent.route.tokens.map(async ({ token, amount }) => {
      const balance = await context.getWalletBalance(chainID, token);

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
