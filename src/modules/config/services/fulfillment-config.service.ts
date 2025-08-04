import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { z } from 'zod';

import { FulfillmentSchema } from '@/config/config.schema';

type FulfillmentConfig = z.infer<typeof FulfillmentSchema>;

@Injectable()
export class FulfillmentConfigService {
  constructor(private configService: ConfigService) {}

  get defaultStrategy(): FulfillmentConfig['defaultStrategy'] {
    return this.configService.get<FulfillmentConfig['defaultStrategy']>(
      'fulfillment.defaultStrategy',
    );
  }

  get fulfillmentConfig(): FulfillmentConfig {
    return this.configService.get<FulfillmentConfig>('fulfillment');
  }

  get validations(): FulfillmentConfig['validations'] {
    return this.configService.get<FulfillmentConfig['validations']>('fulfillment.validations');
  }

  get routeLimits(): FulfillmentConfig['validations']['routeLimits'] {
    return this.configService.get<FulfillmentConfig['validations']['routeLimits']>(
      'fulfillment.validations.routeLimits',
    );
  }

  get nativeFee(): FulfillmentConfig['validations']['nativeFee'] {
    return this.configService.get<FulfillmentConfig['validations']['nativeFee']>(
      'fulfillment.validations.nativeFee',
    );
  }

  get crowdLiquidityFee(): FulfillmentConfig['validations']['crowdLiquidityFee'] {
    return this.configService.get<FulfillmentConfig['validations']['crowdLiquidityFee']>(
      'fulfillment.validations.crowdLiquidityFee',
    );
  }

  get deadlineDuration(): FulfillmentConfig['deadlineDuration'] {
    return this.configService.get<FulfillmentConfig['deadlineDuration']>(
      'fulfillment.deadlineDuration',
    );
  }

  getRouteLimitForChain(chainId: bigint): bigint {
    const routeLimits = this.routeLimits;
    const specificLimit = routeLimits?.routes?.find((route) => route.chainId === chainId);
    return specificLimit?.limit ?? routeLimits?.default ?? 10000000000000000000n;
  }
}
