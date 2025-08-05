import { Injectable, Logger } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';

import { Validation } from './validation.interface';

@Injectable()
export class IntentFundedValidation implements Validation {
  private readonly logger = new Logger(IntentFundedValidation.name);

  constructor(private readonly blockchainReader: BlockchainReaderService) {}

  async validate(intent: Intent, _context: ValidationContext): Promise<boolean> {
    const sourceChainId = intent.route.source;

    try {
      const isFunded = await this.blockchainReader.isIntentFunded(sourceChainId, intent);

      if (!isFunded) {
        throw new Error(`Intent ${intent.intentHash} is not funded on chain ${sourceChainId}`);
      }

      this.logger.debug(`Intent ${intent.intentHash} is funded on chain ${sourceChainId}`);

      return true;
    } catch (error) {
      // If it's already our error message, re-throw it
      if (error.message.includes('is not funded')) {
        throw error;
      }

      // Otherwise, wrap the error
      this.logger.error(`Failed to check funding status for intent ${intent.intentHash}:`, error);
      throw new Error(`Failed to verify intent funding status: ${error.message}`);
    }
  }
}
