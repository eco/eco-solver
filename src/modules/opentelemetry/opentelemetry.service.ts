import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import {
  ConsoleMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

import { toError } from '@/common/utils/error-handler';
import { OpenTelemetryConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';

@Injectable()
export class OpenTelemetryService implements OnModuleInit, OnModuleDestroy {
  public tracer: api.Tracer;
  private sdk?: NodeSDK;
  private meter: api.Meter;
  private meterProvider?: MeterProvider;

  constructor(
    private readonly config: OpenTelemetryConfigService,
    private readonly logger: SystemLoggerService,
  ) {
    this.logger.setContext(OpenTelemetryService.name);
  }

  async onModuleInit() {
    if (!this.config.enabled) {
      this.logger.log('OpenTelemetry is disabled');
      // Initialize with no-op implementations when disabled
      // This ensures code can still call tracing methods without errors
      this.tracer = api.trace.getTracer('solver');
      this.meter = api.metrics.getMeter('solver');
      return;
    }

    try {
      await this.initializeOpenTelemetry();

      // Get tracer and meter after providers are initialized
      this.tracer = api.trace.getTracer('solver');

      this.logger.log('OpenTelemetry initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OpenTelemetry', toError(error));
    }
  }

  async onModuleDestroy() {
    if (this.sdk) {
      try {
        await this.sdk.shutdown();
        this.logger.log('OpenTelemetry shut down successfully');
      } catch (error) {
        this.logger.error('Error shutting down OpenTelemetry', toError(error));
      }
    }
    if (this.meterProvider) {
      try {
        await this.meterProvider.shutdown();
        this.logger.log('OpenTelemetry metrics shut down successfully');
      } catch (error) {
        this.logger.error('Error shutting down OpenTelemetry metrics', toError(error));
      }
    }
  }

  /**
   * Get the OpenTelemetry meter instance
   * Returns the meter after provider initialization, or gets it if not yet retrieved
   */
  getMeter(): api.Meter {
    if (!this.meter) {
      this.meter = api.metrics.getMeter('solver');
    }
    return this.meter;
  }

  /**
   * Get the OpenTelemetry tracer instance
   * Returns the tracer after provider initialization, or gets it if not yet retrieved
   */
  getTracer(): api.Tracer {
    if (!this.tracer) {
      this.tracer = api.trace.getTracer('solver');
    }
    return this.tracer;
  }

  /**
   * Start a new span
   */
  startSpan(name: string, options?: api.SpanOptions): api.Span {
    return this.getTracer().startSpan(name, options);
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
    return this.getTracer().startActiveSpan(name, options || {}, async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: api.SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: api.SpanStatusCode.ERROR });
        throw error;
      }
    });
  }

  /**
   * Create correlation attributes for linking separate traces
   * @param intentHash The intent hash to use as correlation ID
   * @param stage The stage of processing (listener, fulfillment, execution)
   * @param parentTraceId Optional parent trace ID for linking
   */
  createCorrelationAttributes(
    intentHash: string,
    stage: 'listener' | 'fulfillment' | 'execution',
    parentTraceId?: string,
  ): api.Attributes {
    const attributes: api.Attributes = {
      'trace.correlation.id': intentHash,
      'trace.stage': stage,
    };

    if (parentTraceId) {
      attributes['trace.parent.id'] = parentTraceId;
    }

    return attributes;
  }

  /**
   * Start a new root trace with correlation attributes
   * Breaks context propagation to start a fresh trace
   */
  startRootTrace(
    name: string,
    intentHash: string,
    stage: 'listener' | 'fulfillment' | 'execution',
    additionalAttributes?: api.Attributes,
  ): api.Span {
    // Break context propagation by creating span without parent context
    const correlationAttrs = this.createCorrelationAttributes(intentHash, stage);

    return this.getTracer().startSpan(name, {
      root: true, // Ensure this is a root span
      attributes: {
        ...correlationAttrs,
        ...additionalAttributes,
      },
    });
  }

  /**
   * Start a new active span that breaks context propagation
   * Creates a new trace while maintaining correlation through attributes
   */
  async startNewTraceWithCorrelation<T>(
    name: string,
    intentHash: string,
    stage: 'listener' | 'fulfillment' | 'execution',
    fn: (span: api.Span) => Promise<T>,
    additionalAttributes?: api.Attributes,
  ): Promise<T> {
    // Get current trace ID before breaking context (if exists)
    const parentTraceId = this.getCurrentTraceId();

    // Clear the context to start a new trace
    const rootContext = api.ROOT_CONTEXT;

    // Start a new active span in the root context (new trace)
    return api.context.with(rootContext, () => {
      return this.getTracer().startActiveSpan(
        name,
        {
          attributes: {
            ...this.createCorrelationAttributes(intentHash, stage, parentTraceId),
            ...additionalAttributes,
          },
        },
        async (span) => {
          try {
            const result = await fn(span);
            span.setStatus({ code: api.SpanStatusCode.OK });
            return result;
          } catch (error) {
            span.recordException(error as Error);
            span.setStatus({ code: api.SpanStatusCode.ERROR });
            throw error;
          } finally {
            span.end();
          }
        },
      );
    });
  }

  /**
   * Get the current trace ID from the active span
   */
  getCurrentTraceId(): string | undefined {
    const span = this.getActiveSpan();
    if (span) {
      const spanContext = span.spanContext();
      return spanContext.traceId;
    }
    return undefined;
  }

  private async initializeOpenTelemetry() {
    const resource = defaultResource().merge(
      resourceFromAttributes({
        [ATTR_SERVICE_NAME]: this.config.serviceName,
        [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '0.0.0',
        ...this.config.resource.attributes,
      }),
    );

    // Initialize metrics
    await this.initializeMetrics(resource);

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

  private async initializeMetrics(resource: any) {
    const metricExporters = [];

    // Add console exporter in development
    if (process.env.NODE_ENV === 'development') {
      metricExporters.push(
        new PeriodicExportingMetricReader({
          exporter: new ConsoleMetricExporter(),
          exportIntervalMillis: 60000, // Export every minute
        }),
      );
    }

    // OTLP Metric Exporter
    const otlpMetricsUrl = `${this.config.otlp.endpoint}/v1/metrics`;

    const otlpExporter = new OTLPMetricExporter({
      url: otlpMetricsUrl,
      headers: this.config.otlp.headers,
      timeoutMillis: 10000,
    });

    metricExporters.push(
      new PeriodicExportingMetricReader({
        exporter: otlpExporter,
        exportIntervalMillis: 60000, // Export every minute
      }),
    );

    this.meterProvider = new MeterProvider({
      resource,
      readers: metricExporters,
    });

    // Set the global meter provider
    api.metrics.setGlobalMeterProvider(this.meterProvider);

    // Get the meter after provider is set
    this.meter = api.metrics.getMeter('solver');
  }

  private createExporters(): SpanExporter[] {
    const exporters: SpanExporter[] = [];

    // Add console exporter in development
    if (process.env.NODE_ENV === 'development') {
      exporters.push(new ConsoleSpanExporter());
    }

    // OTLP Trace Exporter
    exporters.push(
      new OTLPTraceExporter({
        url: `${this.config.otlp.endpoint}/v1/traces`,
        headers: this.config.otlp.headers,
      }),
    );

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
}
