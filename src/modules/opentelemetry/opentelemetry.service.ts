import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { OTLPTraceExporter as OTLPGrpcTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SpanExporter,
} from '@opentelemetry/sdk-trace-base';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

import { OpenTelemetryConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';

@Injectable()
export class OpenTelemetryService implements OnModuleInit, OnModuleDestroy {
  private sdk?: NodeSDK;
  private tracer: api.Tracer;

  constructor(
    private readonly config: OpenTelemetryConfigService,
    private readonly logger: SystemLoggerService,
  ) {
    this.logger.setContext(OpenTelemetryService.name);
    // Always get tracer - it will be no-op if no provider is registered
    this.tracer = api.trace.getTracer('blockchain-intent-solver');
  }

  async onModuleInit() {
    if (!this.config.enabled) {
      this.logger.log('OpenTelemetry is disabled');
      return;
    }

    try {
      await this.initializeOpenTelemetry();
      this.logger.log('OpenTelemetry initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OpenTelemetry', error);
    }
  }

  async onModuleDestroy() {
    if (this.sdk) {
      try {
        await this.sdk.shutdown();
        this.logger.log('OpenTelemetry shut down successfully');
      } catch (error) {
        this.logger.error('Error shutting down OpenTelemetry', error);
      }
    }
  }

  private async initializeOpenTelemetry() {
    const resource = defaultResource().merge(
      resourceFromAttributes({
        [SEMRESATTRS_SERVICE_NAME]: this.config.serviceName,
        [SEMRESATTRS_SERVICE_VERSION]: process.env.npm_package_version || '0.0.0',
        ...this.config.resource.attributes,
      }),
    );

    const exporters = this.createExporters();
    const spanProcessors = exporters.map((exporter) => new BatchSpanProcessor(exporter));

    const instrumentations = this.createInstrumentations();

    this.sdk = new NodeSDK({
      resource,
      spanProcessors,
      instrumentations,
      traceExporter: exporters[0], // Primary exporter
    });

    await this.sdk.start();
  }

  private createExporters(): SpanExporter[] {
    const exporters: SpanExporter[] = [];

    // Add console exporter in development
    if (process.env.NODE_ENV === 'development') {
      exporters.push(new ConsoleSpanExporter());
    }

    // Add OTLP exporter
    if (this.config.otlp.protocol === 'grpc') {
      exporters.push(
        new OTLPGrpcTraceExporter({
          url: this.config.otlp.endpoint,
          headers: this.config.otlp.headers,
        }),
      );
    } else {
      exporters.push(
        new OTLPTraceExporter({
          url: `${this.config.otlp.endpoint}/v1/traces`,
          headers: this.config.otlp.headers,
        }),
      );
    }

    // Add Jaeger exporter if enabled
    if (this.config.jaeger.enabled) {
      // Note: Jaeger now supports OTLP, so we use OTLP exporter with Jaeger endpoint
      exporters.push(
        new OTLPTraceExporter({
          url: this.config.jaeger.endpoint,
        }),
      );
    }

    return exporters;
  }

  private createInstrumentations() {
    const instrumentations = [];

    if (this.config.instrumentation.http.enabled) {
      instrumentations.push(
        new HttpInstrumentation({
          ignoreIncomingRequestHook: (request) => {
            const url = request.url || '';
            return this.config.instrumentation.http.ignoreIncomingPaths.some((path) =>
              url.includes(path),
            );
          },
        }),
      );
    }

    if (this.config.instrumentation.mongodb.enabled) {
      instrumentations.push(new MongoDBInstrumentation());
    }

    if (this.config.instrumentation.redis.enabled) {
      instrumentations.push(new IORedisInstrumentation());
    }

    if (this.config.instrumentation.nestjs.enabled) {
      instrumentations.push(new NestInstrumentation());
    }

    return instrumentations;
  }

  /**
   * Get the OpenTelemetry tracer instance
   */
  getTracer(): api.Tracer {
    return this.tracer;
  }

  /**
   * Start a new span
   */
  startSpan(name: string, options?: api.SpanOptions): api.Span {
    return this.tracer.startSpan(name, options);
  }

  /**
   * Get the active span from the current context
   */
  getActiveSpan(): api.Span | undefined {
    return api.trace.getActiveSpan();
  }

  /**
   * Add attributes to the active span
   */
  addSpanAttributes(attributes: api.Attributes): void {
    const span = this.getActiveSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  }

  /**
   * Record an exception in the active span
   */
  recordException(error: Error | unknown): void {
    const span = this.getActiveSpan();
    if (span) {
      span.recordException(error as Error);
    }
  }

  /**
   * Execute a function within a span context
   */
  async withSpan<T>(
    name: string,
    fn: (span: api.Span) => Promise<T>,
    options?: api.SpanOptions,
  ): Promise<T> {
    const span = this.startSpan(name, options);

    try {
      return await api.context.with(api.trace.setSpan(api.context.active(), span), async () => {
        return await fn(span);
      });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }
}
