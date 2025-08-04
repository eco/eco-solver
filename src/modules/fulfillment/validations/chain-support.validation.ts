import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainService } from '@/modules/blockchain/blockchain.service';

import { Validation } from './validation.interface';

@Injectable()
export class ChainSupportValidation implements Validation {
  constructor(private readonly blockchainService: BlockchainService) {}

  async validate(intent: Intent): Promise<boolean> {
    if (!intent.route.source) {
      throw new Error('Intent must have source chain ID');
    }

    if (!intent.route.destination) {
      throw new Error('Intent must have destination chain ID');
    }

    if (!this.blockchainService.isChainSupported(intent.route.source)) {
      throw new Error(`Source chain ${intent.route.source} is not supported`);
    }

    if (!this.blockchainService.isChainSupported(intent.route.destination)) {
      throw new Error(`Target chain ${intent.route.destination} is not supported`);
    }

    return true;
  }
}
