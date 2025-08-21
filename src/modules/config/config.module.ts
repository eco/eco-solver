import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';

import { configurationFactory } from '@/config/configuration-factory';
import {
  AppConfigService,
  AwsConfigService,
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
];

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: false,
      load: [
        // Load the configuration factory that handles all env vars and AWS secrets
        configurationFactory,
      ],
      // validate: createZodValidationAdapter(ConfigSchema),
    }),
  ],
  providers: [ConfigService, ...configProviders],
  exports: configProviders,
})
export class ConfigModule {}
