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
} from '@/modules/config/services';
import { AwsSecretsService } from '@/modules/config/services/aws-secrets.service';
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
  AwsSecretsService,
  FulfillmentConfigService,
  DataDogConfigService,
  OpenTelemetryConfigService,
  BlockchainConfigService,
  TokenConfigService,
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
