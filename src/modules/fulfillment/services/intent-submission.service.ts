import { Inject, Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueService } from '@/modules/queue/interfaces/queue-service.interface';

/**
 * Service responsible for intent submission and queueing
 * Single Responsibility: Managing intent submission workflow
 */
@Injectable()
export class IntentSubmissionService {
  constructor(
    private readonly logger: SystemLoggerService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueService,
    private readonly otelService: OpenTelemetryService,
  ) {
    this.logger.setContext(IntentSubmissionService.name);
  }

  /**
   * Submit an intent for processing
   * Queues the intent for fulfillment processing
   * Note: Assumes intent has already been persisted to database by the caller
   */
  async submitIntent(intent: Intent, strategyName?: FulfillmentStrategyName): Promise<void> {
    const span = this.otelService.startSpan('intent.submission.submit', {
      attributes: {
        'intent.hash': intent.intentHash,
        'intent.source_chain': intent.sourceChainId?.toString() || 'unknown',
        'intent.destination_chain': intent.destination.toString(),
        'submission.strategy': strategyName || 'default',
      },
    });

    try {
      // Queue for fulfillment
      await this.queueIntent(intent, strategyName);

      span.setAttribute('submission.success', true);
      span.setStatus({ code: api.SpanStatusCode.OK });

      this.logger.log(`Intent submitted successfully: ${intent.intentHash}`, {
        intentHash: intent.intentHash,
        strategy: strategyName || 'default',
        sourceChain: intent.sourceChainId?.toString(),
        destinationChain: intent.destination.toString(),
      });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });

      this.logger.error(`Failed to submit intent: ${intent.intentHash}`, error, {
        intentHash: intent.intentHash,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Queue intent for processing
   */
  private async queueIntent(intent: Intent, strategyName: FulfillmentStrategyName): Promise<void> {
    const span = this.otelService.startSpan('intent.submission.queue', {
      attributes: {
        'intent.hash': intent.intentHash,
        'queue.strategy': strategyName,
      },
    });

    try {
      await this.queueService.addIntentToFulfillmentQueue(intent, strategyName);
      span.setStatus({ code: api.SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }
}
