import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FulfillmentConfig } from '@/config/schemas';

import { BlockchainConfigService } from './blockchain-config.service';

@Injectable()
export class FulfillmentConfigService {
  constructor(
    private readonly configService: ConfigService,
    private readonly blockchainConfigService: BlockchainConfigService,
  ) {}

  get defaultStrategy(): FulfillmentConfig['defaultStrategy'] {
    return this.configService.get<FulfillmentConfig['defaultStrategy']>(
      'fulfillment.defaultStrategy',
    )!;
  }

  get fulfillmentConfig(): FulfillmentConfig {
    return this.configService.get<FulfillmentConfig>('fulfillment')!;
  }

  get validations(): FulfillmentConfig['validations'] {
    return this.configService.get<FulfillmentConfig['validations']>('fulfillment.validations')!;
  }

  get deadlineDuration(): FulfillmentConfig['deadlineDuration'] | undefined {
    return this.configService.get<FulfillmentConfig['deadlineDuration']>(
      'fulfillment.deadlineDuration',
    );
  }

  getNetworkFee(chainId: bigint | number | string) {
    return this.blockchainConfigService.getFeeLogic(chainId);
  }
}
