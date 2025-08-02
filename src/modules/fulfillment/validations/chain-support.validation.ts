import { Injectable } from '@nestjs/common';
import { Intent } from '@/modules/intents/interfaces/intent.interface';
import { Validation } from './validation.interface';

@Injectable()
export class ChainSupportValidation implements Validation {
  // TODO: Inject configuration service to get supported chains
  private supportedChains: Set<string | number> = new Set([
    1, // Ethereum Mainnet
    10, // Optimism
    137, // Polygon
    42161, // Arbitrum
    // Add more supported chains
  ]);

  async validate(intent: Intent): Promise<boolean> {
    if (!intent.source?.chainId) {
      throw new Error('Intent must have source chain ID');
    }

    if (!intent.target?.chainId) {
      throw new Error('Intent must have target chain ID');
    }

    if (!this.supportedChains.has(intent.source.chainId)) {
      throw new Error(`Source chain ${intent.source.chainId} is not supported`);
    }

    if (!this.supportedChains.has(intent.target.chainId)) {
      throw new Error(`Target chain ${intent.target.chainId} is not supported`);
    }

    return true;
  }
}