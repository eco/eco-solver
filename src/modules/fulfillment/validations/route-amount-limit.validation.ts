import { Injectable } from '@nestjs/common';
import { Intent } from '@/modules/intents/interfaces/intent.interface';
import { Validation } from './validation.interface';

@Injectable()
export class RouteAmountLimitValidation implements Validation {
  // TODO: Inject configuration service to get route amount limits
  private routeLimits: Map<string, bigint> = new Map([
    // Add route-specific limits here
    // Key: routeId (e.g., "1-10" for mainnet to optimism)
    // Value: max amount in wei
  ]);

  async validate(intent: Intent): Promise<boolean> {
    const amount = BigInt(intent.value);
    
    if (amount <= 0n) {
      throw new Error('Intent amount must be greater than 0');
    }

    // Create route key from source and target chain IDs
    const routeKey = `${intent.source.chainId}-${intent.target.chainId}`;
    
    // TODO: Get actual route limit from configuration
    const limit = this.routeLimits.get(routeKey) || BigInt(10) * BigInt(10 ** 18); // Default 10 ETH
    
    if (amount > limit) {
      throw new Error(`Amount ${amount} exceeds route limit ${limit} for route ${routeKey}`);
    }

    return true;
  }
}