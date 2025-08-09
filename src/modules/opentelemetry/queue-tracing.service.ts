import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { OpenTelemetryService } from './opentelemetry.service';

@Injectable()
export class QueueTracingService {
  constructor(private readonly otelService: OpenTelemetryService) {}

  /**
   * Wrap a queue job processor with tracing
   */
  wrapProcessor<T = any>(
    processorName: string,
    queueName: string,
    processor: (job: T) => Promise<any>,
  ): (job: T) => Promise<any> {
    return async (job: T) => {
      const jobData = job as any;
      const spanName = `queue.process ${queueName}/${processorName}`;

      return this.otelService.withSpan(
        spanName,
        async (span) => {
          // Add queue job attributes
          span.setAttributes({
            'messaging.system': 'bullmq',
            'messaging.destination': queueName,
            'messaging.destination_kind': 'queue',
            'messaging.operation': 'process',
            'queue.job.id': jobData.id,
            'queue.job.name': jobData.name,
            'queue.job.attemptNumber': jobData.attemptsMade + 1,
            'queue.job.timestamp': jobData.timestamp,
            'queue.processor.name': processorName,
          });

          // Add job data attributes (be careful with sensitive data)
          if (jobData.data?.strategy) {
            span.setAttribute('queue.job.strategy', jobData.data.strategy);
          }
          if (jobData.data?.chainId) {
            span.setAttribute('queue.job.chainId', jobData.data.chainId);
          }
          if (jobData.data?.intent?.intentId) {
            span.setAttribute('intent.id', jobData.data.intent.intentId);
          }

          try {
            const result = await processor(job);
            span.setStatus({ code: api.SpanStatusCode.OK });
            return result;
          } catch (error) {
            span.recordException(error as Error);
            span.setStatus({
              code: api.SpanStatusCode.ERROR,
              message: (error as Error).message,
            });
            throw error;
          }
        },
        {
          kind: api.SpanKind.CONSUMER,
        },
      );
    };
  }

  /**
   * Create a span for adding a job to a queue
   */
  async traceQueueAdd<T = any>(
    queueName: string,
    jobName: string,
    data: T,
    fn: () => Promise<any>,
  ): Promise<any> {
    const spanName = `queue.add ${queueName}/${jobName}`;

    return this.otelService.withSpan(
      spanName,
      async (span) => {
        span.setAttributes({
          'messaging.system': 'bullmq',
          'messaging.destination': queueName,
          'messaging.destination_kind': 'queue',
          'messaging.operation': 'send',
          'queue.job.name': jobName,
        });

        // Add relevant data attributes
        const jobData = data as any;
        if (jobData.strategy) {
          span.setAttribute('queue.job.strategy', jobData.strategy);
        }
        if (jobData.chainId) {
          span.setAttribute('queue.job.chainId', jobData.chainId);
        }
        if (jobData.intent?.intentId) {
          span.setAttribute('intent.id', jobData.intent.intentId);
        }

        try {
          const result = await fn();
          span.setStatus({ code: api.SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: (error as Error).message,
          });
          throw error;
        }
      },
      {
        kind: api.SpanKind.PRODUCER,
      },
    );
  }

  /**
   * Add event to current span for job state changes
   */
  addJobEvent(eventName: string, attributes?: api.Attributes): void {
    const span = this.otelService.getActiveSpan();
    if (span) {
      span.addEvent(eventName, attributes);
    }
  }

  /**
   * Link spans together (useful for correlating producer and consumer spans)
   */
  linkToCurrentSpan(): api.Link | undefined {
    const span = this.otelService.getActiveSpan();
    if (span) {
      const spanContext = span.spanContext();
      return {
        context: spanContext,
      };
    }
    return undefined;
  }
}
