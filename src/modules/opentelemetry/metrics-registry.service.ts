import { Injectable, OnModuleInit } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { OpenTelemetryService } from './opentelemetry.service';

@Injectable()
export class MetricsRegistryService implements OnModuleInit {
  private meter: api.Meter;

  // Intent metrics
  private intentsProcessedCounter: api.Counter<api.Attributes>;
  private intentsAttemptedCounter: api.Counter<api.Attributes>;
  private intentsFulfilledCounter: api.Counter<api.Attributes>;
  private intentsProvenCounter: api.Counter<api.Attributes>;
  private intentsWithdrawnCounter: api.Counter<api.Attributes>;
  private intentsFailedCounter: api.Counter<api.Attributes>;

  // Queue metrics
  private queueDepthGauge: api.ObservableGauge<api.Attributes>;
  private queueDepthCallbacks = new Map<string, number>();

  // HTTP metrics
  private httpRequestsCounter: api.Counter<api.Attributes>;
  private httpRequestDurationHistogram: api.Histogram<api.Attributes>;
  private httpErrorsCounter: api.Counter<api.Attributes>;

  constructor(private readonly otelService: OpenTelemetryService) {}

  onModuleInit() {
    this.meter = this.otelService.getMeter();
    this.initializeIntentMetrics();
    this.initializeQueueMetrics();
    this.initializeHttpMetrics();
  }

  private initializeIntentMetrics() {
    this.intentsProcessedCounter = this.meter.createCounter('intents.processed', {
      description: 'Total number of intents processed',
      unit: '1',
    });

    this.intentsAttemptedCounter = this.meter.createCounter('intents.attempted', {
      description: 'Total number of intents attempted for fulfillment',
      unit: '1',
    });

    this.intentsFulfilledCounter = this.meter.createCounter('intents.fulfilled', {
      description: 'Total number of intents successfully fulfilled',
      unit: '1',
    });

    this.intentsProvenCounter = this.meter.createCounter('intents.proven', {
      description: 'Total number of intents proven',
      unit: '1',
    });

    this.intentsWithdrawnCounter = this.meter.createCounter('intents.withdrawn', {
      description: 'Total number of intents withdrawn',
      unit: '1',
    });

    this.intentsFailedCounter = this.meter.createCounter('intents.failed', {
      description: 'Total number of intents that failed',
      unit: '1',
    });
  }

  private initializeQueueMetrics() {
    this.queueDepthGauge = this.meter.createObservableGauge('queue.depth', {
      description: 'Current depth of queues',
      unit: '1',
    });

    this.queueDepthGauge.addCallback((observableResult) => {
      this.queueDepthCallbacks.forEach((depth, queueName) => {
        observableResult.observe(depth, { queue: queueName });
      });
    });
  }

  private initializeHttpMetrics() {
    this.httpRequestsCounter = this.meter.createCounter('http.requests.total', {
      description: 'Total number of HTTP requests',
      unit: '1',
    });

    this.httpRequestDurationHistogram = this.meter.createHistogram('http.request.duration', {
      description: 'HTTP request duration in milliseconds',
      unit: 'ms',
    });

    this.httpErrorsCounter = this.meter.createCounter('http.errors', {
      description: 'Total number of HTTP errors',
      unit: '1',
    });
  }

  // Intent metric methods
  recordIntentProcessed(sourceChain: string, destinationChain: string, strategy: string) {
    const attributes = {
      source_chain: sourceChain,
      destination_chain: destinationChain,
      strategy,
    };
    this.intentsProcessedCounter.add(1, attributes);
  }

  recordIntentAttempted(sourceChain: string, destinationChain: string, strategy: string) {
    const attributes = {
      source_chain: sourceChain,
      destination_chain: destinationChain,
      strategy,
    };
    this.intentsAttemptedCounter.add(1, attributes);
  }

  recordIntentFulfilled(sourceChain: string, destinationChain: string, strategy: string) {
    const attributes = {
      source_chain: sourceChain,
      destination_chain: destinationChain,
      strategy,
    };
    this.intentsFulfilledCounter.add(1, attributes);
  }

  recordIntentProven(sourceChain: string, destinationChain: string) {
    const attributes = {
      source_chain: sourceChain,
      destination_chain: destinationChain,
    };
    this.intentsProvenCounter.add(1, attributes);
  }

  recordIntentWithdrawn(sourceChain: string) {
    const attributes = {
      source_chain: sourceChain,
    };
    this.intentsWithdrawnCounter.add(1, attributes);
  }

  recordIntentFailed(sourceChain: string, destinationChain: string, strategy: string) {
    const attributes = {
      source_chain: sourceChain,
      destination_chain: destinationChain,
      strategy,
    };
    this.intentsFailedCounter.add(1, attributes);
  }

  // Queue metric methods
  setQueueDepth(queueName: string, depth: number) {
    this.queueDepthCallbacks.set(queueName, depth);
  }

  // HTTP metric methods
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    const attributes = {
      method,
      route,
      status_code: statusCode.toString(),
    };

    this.httpRequestsCounter.add(1, attributes);
    this.httpRequestDurationHistogram.record(duration, attributes);

    if (statusCode >= 400) {
      this.httpErrorsCounter.add(1, {
        ...attributes,
        error_type: statusCode >= 500 ? '5xx' : '4xx',
      });
    }
  }
}
