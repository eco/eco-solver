import { Injectable, Logger } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';

import { Validation } from './validation.interface';

@Injectable()
export class FundingValidation implements Validation {
  private readonly logger = new Logger(FundingValidation.name);

  constructor(private readonly blockchainReader: BlockchainReaderService) {}

  async validate(intent: Intent): Promise<boolean> {
    const sourceChainId = intent.route.source;

    // Validate token amounts and check balances
    for (const token of intent.route.tokens) {
      // Verify the creator has sufficient token balance on source chain
      try {
        const balance = await this.blockchainReader.getTokenBalance(
          sourceChainId,
          token.token,
          intent.reward.creator,
        );

        if (balance < token.amount) {
          throw new Error(
            `Insufficient token balance for ${token.token}. Required: ${token.amount}, Available: ${balance}`,
          );
        }
      } catch (error) {
        this.logger.error(`Failed to check token balance for ${token.token}:`, error);
        throw new Error(`Failed to verify token balance for ${token.token}: ${error.message}`);
      }
    }

    // Check native token balance if native value is required
    if (intent.reward.nativeValue > 0n) {
      try {
        const nativeBalance = await this.blockchainReader.getBalance(
          sourceChainId,
          intent.reward.creator,
        );

        if (nativeBalance < intent.reward.nativeValue) {
          throw new Error(
            `Insufficient native token balance. Required: ${intent.reward.nativeValue}, Available: ${nativeBalance}`,
          );
        }
      } catch (error) {
        this.logger.error('Failed to check native token balance:', error);
        throw new Error(`Failed to verify native token balance: ${error.message}`);
      }
    }

    return true;
  }
}
