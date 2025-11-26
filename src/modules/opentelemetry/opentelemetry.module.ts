import { DynamicModule, Global, Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { OpenTelemetryConfigService } from '@/modules/config/services';
import { LoggingModule } from '@/modules/logging/logging.module';

import { BullMQOtelFactory } from './bullmq-otel.factory';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsRegistryService } from './metrics-registry.service';
import { OpenTelemetryService } from './opentelemetry.service';
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
        BullMQOtelFactory,
        MetricsRegistryService,
        HttpMetricsInterceptor,
        TraceInterceptor,
        {
          provide: 'OTEL_ENABLED',
          useFactory: (config: OpenTelemetryConfigService) => config.enabled,
          inject: [OpenTelemetryConfigService],
        },
      ],
      exports: [
        OpenTelemetryService,
        BullMQOtelFactory,
        MetricsRegistryService,
        HttpMetricsInterceptor,
        TraceInterceptor,
      ],
    };
  }
}
