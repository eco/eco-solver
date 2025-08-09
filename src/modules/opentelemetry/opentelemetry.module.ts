import { DynamicModule, Global, Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { OpenTelemetryConfigService } from '@/modules/config/services';
import { LoggingModule } from '@/modules/logging/logging.module';

import { BlockchainTracingService } from './blockchain-tracing.service';
import { OpenTelemetryService } from './opentelemetry.service';
import { QueueTracingService } from './queue-tracing.service';
import { TraceInterceptor } from './trace.interceptor';

@Global()
@Module({})
export class OpenTelemetryModule {
  static forRootAsync(): DynamicModule {
    return {
      module: OpenTelemetryModule,
      imports: [ConfigModule, LoggingModule],
      providers: [
        OpenTelemetryService,
        BlockchainTracingService,
        QueueTracingService,
        TraceInterceptor,
        {
          provide: 'OTEL_ENABLED',
          useFactory: (config: OpenTelemetryConfigService) => config.enabled,
          inject: [OpenTelemetryConfigService],
        },
      ],
      exports: [
        OpenTelemetryService,
        BlockchainTracingService,
        QueueTracingService,
        TraceInterceptor,
      ],
    };
  }
}
