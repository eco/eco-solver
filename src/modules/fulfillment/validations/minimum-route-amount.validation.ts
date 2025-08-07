import { Injectable } from '@nestjs/common';

import { parseUnits } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { normalize } from '@/common/tokens/normalize';
import { min, sum } from '@/common/utils/math';
import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';

import { Validation } from './validation.interface';

@Injectable()
export class MinimumRouteAmountValidation implements Validation {
  constructor(private readonly fulfillmentConfigService: FulfillmentConfigService) {}

  async validate(intent: Intent, _context: ValidationContext): Promise<boolean> {
    // Calculate total value being transferred
    const normalizedTokens = this.fulfillmentConfigService.normalize(
      intent.route.destination,
      intent.route.tokens,
    );
    const totalValue = sum(normalizedTokens, 'amount');

    // Get minimum limits from all tokens
    const tokenMinimums = intent.route.tokens.map((token) => {
      const { limit, decimals } = this.fulfillmentConfigService.getToken(
        intent.route.destination,
        token.token,
      );

      if (!limit) {
        // If no limit is set, no minimum requirement (return max value to exclude from min calculation)
        return BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      }

      // Extract min value from either number format (no min) or object format
      const minLimit = typeof limit === 'number' ? 0 : (limit.min ?? 0);

      if (minLimit === 0) {
        // No minimum requirement (return max value to exclude from min calculation)
        return BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      }

      const limitWei = parseUnits(minLimit.toString(), decimals);
      return normalize(limitWei, decimals);
    });

    // Use the smallest minimum as the threshold
    const minimumAmount = min(tokenMinimums);

    // If all tokens have no minimum (all returned max value), then no minimum requirement
    if (
      minimumAmount === BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    ) {
      return true;
    }

    if (totalValue < minimumAmount) {
      throw new Error(
        `Total route value ${totalValue} is below minimum amount ${minimumAmount} for destination chain ${intent.route.destination}`,
      );
    }

    return true;
  }
}
