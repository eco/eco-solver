import { DynamicModule, Global, Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { LoggingModule } from '@/modules/logging/logging.module';

import { DataDogInterceptor } from './datadog.interceptor';
import { DataDogService } from './datadog.service';

@Global()
@Module({})
export class DataDogModule {
  static forRootAsync(): DynamicModule {
    return {
      module: DataDogModule,
      imports: [ConfigModule, LoggingModule],
      providers: [DataDogService, DataDogInterceptor],
      exports: [DataDogService, DataDogInterceptor],
    };
  }
}
