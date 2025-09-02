import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { z } from 'zod';

import { normalize } from '@/common/tokens/normalize';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { FulfillmentSchema } from '@/config/config.schema';
import { TokenConfigService } from '@/modules/config/services/token-config.service';

import { BlockchainConfigService } from './blockchain-config.service';

type FulfillmentConfig = z.infer<typeof FulfillmentSchema>;

@Injectable()
export class FulfillmentConfigService {
  constructor(
    private readonly configService: ConfigService,
    private readonly blockchainConfigService: BlockchainConfigService,
    private readonly tokenConfigService: TokenConfigService,
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

  getToken(chainId: bigint | number | string, address: UniversalAddress) {
    return this.tokenConfigService.getTokenConfig(chainId, address as UniversalAddress);
  }

  normalize<
    Tokens extends Readonly<Token> | Readonly<Token[]>,
    Token extends Readonly<{ amount: bigint; token: UniversalAddress }>,
    Normalized extends {
      token: UniversalAddress;
      decimals: number;
      amount: bigint;
    },
    Result extends Tokens extends Readonly<Token[]> ? Normalized[] : Normalized,
  >(chainId: bigint | number | string, tokens: Tokens): Result {
    if (tokens instanceof Array) {
      return tokens.map((token) => {
        const { decimals } = this.tokenConfigService.getTokenConfig(
          chainId,
          token.token as UniversalAddress,
        );
        return { token: token.token, decimals, amount: normalize(token.amount, decimals) };
      }) as Result;
    }

    const { decimals } = this.tokenConfigService.getTokenConfig(
      chainId,
      tokens.token as UniversalAddress,
    );
    return { token: tokens.token, decimals, amount: normalize(tokens.amount, decimals) } as Result;
  }
}
