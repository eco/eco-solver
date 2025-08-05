import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { normalize } from '@/common/tokens/normalize';
import { EvmTokenConfig } from '@/config/schemas';
import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';

import { Validation } from './validation.interface';

@Injectable()
export class RouteAmountLimitValidation implements Validation {
  constructor(private readonly fulfillmentConfigService: FulfillmentConfigService) {}

  async validate(intent: Intent): Promise<boolean> {
    // Calculate total value being transferred
    const totalValue = this.fulfillmentConfigService.sum(
      intent.route.destination,
      intent.route.tokens,
    );

    // TODO: Fix with normalize

    // Get route limit from configuration
    // const limitToken = intent.route.tokens.reduce<EvmTokenConfig>((smaller, token) => {
    //   const { limit } = this.fulfillmentConfigService.getToken(
    //     intent.route.destination,
    //     token.token,
    //   );
    //
    //   const normalizedLimit = normalize(limit, token.token);
    //
    //   if (!smaller || smaller.limit > token.limit) return token;
    //   if (smaller.amount < limit) return smaller;
    // }, undefined);
    //
    // if (totalValue > limit) {
    //   throw new Error(
    //     `Total value ${totalValue} exceeds route limit ${limit} for route ${intent.route.source}-${intent.route.destination}`,
    //   );
    // }

    return true;
  }
}
