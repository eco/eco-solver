import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';

import { configurationFactory } from '@/config/configuration-factory';
import {
  AppConfigService,
  AwsConfigService,
  BlockchainConfigService,
  DatabaseConfigService,
  DataDogConfigService,
  EvmConfigService,
  FulfillmentConfigService,
  OpenTelemetryConfigService,
  QueueConfigService,
  RedisConfigService,
  SolanaConfigService,
  TvmConfigService,
  WithdrawalConfigService,
} from '@/modules/config/services';
import { BullBoardConfigService } from '@/modules/config/services/bull-board-config.service';
import { FeeResolverService } from '@/modules/config/services/fee-resolver.service';
import { LeaderElectionConfigService } from '@/modules/config/services/leader-election-config.service';
import { QuotesConfigService } from '@/modules/config/services/quotes-config.service';
import { TokenConfigService } from '@/modules/config/services/token-config.service';

const configProviders = [
  DatabaseConfigService,
  RedisConfigService,
  EvmConfigService,
  SolanaConfigService,
  TvmConfigService,
  QueueConfigService,
  AppConfigService,
  AwsConfigService,
  BullBoardConfigService,
  FulfillmentConfigService,
  DataDogConfigService,
  OpenTelemetryConfigService,
  BlockchainConfigService,
  TokenConfigService,
  WithdrawalConfigService,
  QuotesConfigService,
  LeaderElectionConfigService,
  FeeResolverService,
];

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: false,
      load: [configurationFactory],
    }),
  ],
  providers: [ConfigService, ...configProviders],
  exports: configProviders,
})
export class ConfigModule {}
