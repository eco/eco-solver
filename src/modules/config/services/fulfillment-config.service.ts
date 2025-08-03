import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { z } from 'zod';

import { FulfillmentSchema } from '@/config/config.schema';
import {
  FULFILLMENT_STRATEGY_NAMES,
  FulfillmentStrategyName,
} from '@/modules/fulfillment/types/strategy-name.type';

type FulfillmentConfig = z.infer<typeof FulfillmentSchema>;

@Injectable()
export class FulfillmentConfigService {
  constructor(private configService: ConfigService) {}

  get defaultStrategy(): FulfillmentConfig['defaultStrategy'] {
    return this.configService.get<FulfillmentConfig['defaultStrategy']>(
      'fulfillment.defaultStrategy',
    );
  }

  get strategies(): FulfillmentConfig['strategies'] {
    return this.configService.get<FulfillmentConfig['strategies']>('fulfillment.strategies');
  }

  isStrategyEnabled(strategy: FulfillmentStrategyName): boolean {
    const strategies = this.strategies;
    switch (strategy) {
      case FULFILLMENT_STRATEGY_NAMES.STANDARD:
        return strategies?.standard?.enabled ?? true;
      case FULFILLMENT_STRATEGY_NAMES.CROWD_LIQUIDITY:
        return strategies?.crowdLiquidity?.enabled ?? true;
      case FULFILLMENT_STRATEGY_NAMES.NATIVE_INTENTS:
        return strategies?.nativeIntents?.enabled ?? true;
      case FULFILLMENT_STRATEGY_NAMES.NEGATIVE_INTENTS:
        return strategies?.negativeIntents?.enabled ?? true;
      case FULFILLMENT_STRATEGY_NAMES.RHINESTONE:
        return strategies?.rhinestone?.enabled ?? true;
      default:
        return false;
    }
  }

  get fulfillmentConfig(): FulfillmentConfig {
    return this.configService.get<FulfillmentConfig>('fulfillment');
  }
}
