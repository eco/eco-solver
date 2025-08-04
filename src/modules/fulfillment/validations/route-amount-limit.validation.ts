import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';

import { Validation } from './validation.interface';

@Injectable()
export class RouteAmountLimitValidation implements Validation {
  constructor(private readonly fulfillmentConfigService: FulfillmentConfigService) {}

  async validate(intent: Intent): Promise<boolean> {
    // Create route key from source and destination chain IDs
    const routeKey = `${intent.route.source}-${intent.route.destination}`;

    // Calculate total value being transferred
    let totalValue = 0n;

    // Add native value from reward
    if (intent.reward.nativeValue) {
      totalValue += intent.reward.nativeValue;
    }

    // Add token values
    if (intent.route.tokens && intent.route.tokens.length > 0) {
      for (const token of intent.route.tokens) {
        totalValue += token.amount;
      }
    }

    // Add call values
    if (intent.route.calls && intent.route.calls.length > 0) {
      for (const call of intent.route.calls) {
        totalValue += call.value;
      }
    }

    if (totalValue <= 0n) {
      throw new Error('Total intent value must be greater than 0');
    }

    // Get route limit from configuration
    const limit = this.fulfillmentConfigService.getRouteLimitForChain(intent.route.destination);

    if (totalValue > limit) {
      throw new Error(
        `Total value ${totalValue} exceeds route limit ${limit} for route ${routeKey}`,
      );
    }

    return true;
  }
}
