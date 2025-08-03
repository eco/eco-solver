import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';

import { ConfigSchema } from '@/config/config.schema';
import { configurationFactory } from '@/config/configuration-factory';
import { createZodValidationAdapter } from '@/config/zod-validation.adapter';
import {
  AppConfigService,
  AwsConfigService,
  DatabaseConfigService,
  EvmConfigService,
  FulfillmentConfigService,
  QueueConfigService,
  RedisConfigService,
  SolanaConfigService,
} from '@/modules/config/services';
import { AwsSecretsService } from '@/modules/config/services/aws-secrets.service';

const configProviders = [
  DatabaseConfigService,
  RedisConfigService,
  EvmConfigService,
  SolanaConfigService,
  QueueConfigService,
  AppConfigService,
  AwsConfigService,
  AwsSecretsService,
  FulfillmentConfigService,
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
      validate: createZodValidationAdapter(ConfigSchema),
    }),
  ],
  providers: [ConfigService, ...configProviders],
  exports: configProviders,
})
export class ConfigModule {}
