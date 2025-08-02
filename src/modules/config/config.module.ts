import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';

import { ConfigSchema } from '@/config/config.schema';
import { configurationFactory } from '@/config/configuration-factory';
import {
  createZodValidationAdapter,
  transformEnvVarsForValidation,
} from '@/config/zod-validation.adapter';
import {
  AppConfigService,
  AwsConfigService,
  DatabaseConfigService,
  EvmConfigService,
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
];

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: false,
      load: [configurationFactory],
      validate: (config: Record<string, any>) => {
        // Transform environment variables to proper types
        const transformed = transformEnvVarsForValidation(config);
        // Validate using Zod schema
        return createZodValidationAdapter(ConfigSchema)(transformed);
      },
    }),
  ],
  providers: [ConfigService, ...configProviders],
  exports: configProviders,
})
export class ConfigModule {}
