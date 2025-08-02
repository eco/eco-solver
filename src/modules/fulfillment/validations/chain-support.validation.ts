import { Injectable } from '@nestjs/common';
import { Intent } from '@/common/interfaces/intent.interface';
import { Validation } from './validation.interface';

@Injectable()
export class ChainSupportValidation implements Validation {
  // TODO: Inject configuration service to get supported chains
  private supportedChains: Set<bigint> = new Set([
    1n, // Ethereum Mainnet
    10n, // Optimism
    137n, // Polygon
    42161n, // Arbitrum
    // Add more supported chains
  ]);

  async validate(intent: Intent): Promise<boolean> {
    if (!intent.route.source) {
      throw new Error('Intent must have source chain ID');
    }

    if (!intent.route.destination) {
      throw new Error('Intent must have destination chain ID');
    }

    if (!this.supportedChains.has(intent.route.source)) {
      throw new Error(`Source chain ${intent.route.source} is not supported`);
    }

    if (!this.supportedChains.has(intent.route.destination)) {
      throw new Error(`Target chain ${intent.route.destination} is not supported`);
    }

    return true;
  }
}