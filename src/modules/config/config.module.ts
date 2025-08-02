import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';

import configuration from '@/config/configuration';
import { validationSchema } from '@/config/validation';
import {
  AppConfigService,
  DatabaseConfigService,
  EvmConfigService,
  QueueConfigService,
  RedisConfigService,
  SolanaConfigService,
} from '@/modules/config/services';

const configProviders = [
  DatabaseConfigService,
  RedisConfigService,
  EvmConfigService,
  SolanaConfigService,
  QueueConfigService,
  AppConfigService,
];

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: false,
      load: [configuration],
      validationSchema,
    }),
  ],
  providers: [ConfigService, ...configProviders],
  exports: configProviders,
})
export class ConfigModule {}
