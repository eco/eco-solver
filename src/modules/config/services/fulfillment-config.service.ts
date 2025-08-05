import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Address } from 'viem';
import { z } from 'zod';

import { normalize } from '@/common/tokens/normalize';
import { FulfillmentSchema } from '@/config/config.schema';
import { EvmConfigService } from '@/modules/config/services/evm-config.service';

type FulfillmentConfig = z.infer<typeof FulfillmentSchema>;

@Injectable()
export class FulfillmentConfigService {
  constructor(
    private readonly configService: ConfigService,
    private readonly evmConfigService: EvmConfigService,
  ) {}

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

  get deadlineDuration(): FulfillmentConfig['deadlineDuration'] {
    return this.configService.get<FulfillmentConfig['deadlineDuration']>(
      'fulfillment.deadlineDuration',
    );
  }

  getNetworkFee(chainId: bigint | number) {
    return this.evmConfigService.getFeeLogic(Number(chainId));
  }

  getToken(chainId: bigint | number, address: Address) {
    return this.evmConfigService.getTokenConfig(chainId, address);
  }

  sum(chainId: bigint, tokens: Readonly<{ amount: bigint; token: Address }[]>): bigint {
    return tokens.reduce((acc, token) => {
      const { decimals } = this.evmConfigService.getTokenConfig(Number(chainId), token.token);
      return acc + normalize(token.amount, decimals);
    }, 0n);
  }
}
