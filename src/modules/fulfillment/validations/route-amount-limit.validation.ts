import { Injectable } from '@nestjs/common';

import { parseUnits } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { normalize } from '@/common/tokens/normalize';
import { min, sum } from '@/common/utils/math';
import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';

import { Validation } from './validation.interface';

@Injectable()
export class RouteAmountLimitValidation implements Validation {
  constructor(private readonly fulfillmentConfigService: FulfillmentConfigService) {}

  async validate(intent: Intent): Promise<boolean> {
    // Calculate total value being transferred
    const normalizedTokens = this.fulfillmentConfigService.normalize(
      intent.route.destination,
      intent.route.tokens,
    );
    const totalValue = sum(normalizedTokens, 'amount');

    // Get the smallest token limit from configuration
    const tokenLimits = intent.route.tokens.map((token) => {
      const { limit, decimals } = this.fulfillmentConfigService.getToken(
        intent.route.destination,
        token.token,
      );

      const limitWei = parseUnits(limit.toString(), decimals);
      return normalize(limitWei, decimals);
    });

    const limit = min(tokenLimits);

    if (totalValue > limit) {
      throw new Error(
        `Total value ${totalValue} exceeds route limit ${limit} for route ${intent.route.source}-${intent.route.destination}`,
      );
    }

    return true;
  }
}
