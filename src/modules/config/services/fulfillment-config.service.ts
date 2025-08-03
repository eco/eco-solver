import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { z } from 'zod';

import { FulfillmentSchema } from '@/config/config.schema';

type FulfillmentConfig = z.infer<typeof FulfillmentSchema>;

@Injectable()
export class FulfillmentConfigService {
  constructor(private configService: ConfigService) {}

  get defaultStrategy(): FulfillmentConfig['defaultStrategy'] {
    return this.configService.get<FulfillmentConfig['defaultStrategy']>('fulfillment.defaultStrategy');
  }

  get strategies(): FulfillmentConfig['strategies'] {
    return this.configService.get<FulfillmentConfig['strategies']>('fulfillment.strategies');
  }

  isStrategyEnabled(strategy: string): boolean {
    const strategies = this.strategies;
    switch (strategy) {
      case 'standard':
        return strategies?.standard?.enabled ?? true;
      case 'crowd-liquidity':
        return strategies?.crowdLiquidity?.enabled ?? true;
      case 'native-intents':
        return strategies?.nativeIntents?.enabled ?? true;
      case 'negative-intents':
        return strategies?.negativeIntents?.enabled ?? true;
      case 'rhinestone':
        return strategies?.rhinestone?.enabled ?? true;
      default:
        return false;
    }
  }

  get fulfillmentConfig(): FulfillmentConfig {
    return this.configService.get<FulfillmentConfig>('fulfillment');
  }
}