import { Inject, Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { Intent } from '@/common/interfaces/intent.interface';
import { toError } from '@/common/utils/error-handler';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { IQueueService } from '@/modules/queue/interfaces/queue-service.interface';

/**
 * Service responsible for intent submission and queueing
 * Single Responsibility: Managing intent submission workflow
 */
@Injectable()
export class IntentSubmissionService {
  constructor(
    @InjectPinoLogger(IntentSubmissionService.name) private readonly logger: PinoLogger,
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  /**
   * Submit an intent for processing
   * Queues the intent for fulfillment processing
   * Note: Assumes the caller has already persisted intent to the database
   */
  async submitIntent(intent: Intent, strategyName: FulfillmentStrategyName): Promise<void> {
    return this.otelService.tracer.startActiveSpan(
      'intent.submission.submit',
      {
        attributes: {
          'intent.hash': intent.intentHash,
          'intent.source_chain': intent.sourceChainId.toString(),
          'intent.destination_chain': intent.destination.toString(),
          'submission.strategy': strategyName,
        },
      },
      async (span) => {
        try {
          // Queue for fulfillment
          await this.queueIntent(intent, strategyName);

          span.setAttribute('submission.success', true);
          span.setStatus({ code: api.SpanStatusCode.OK });

          this.logger.info(`Intent submitted successfully: ${intent.intentHash}`, {
            intentHash: intent.intentHash,
            strategy: strategyName,
            sourceChain: intent.sourceChainId.toString(),
            destinationChain: intent.destination.toString(),
          });
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });

          this.logger.error(`Failed to submit intent: ${intent.intentHash}`, toError(error), {
            intentHash: intent.intentHash,
          });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Queue intent for processing
   */
  private async queueIntent(intent: Intent, strategyName: FulfillmentStrategyName): Promise<void> {
    return this.otelService.tracer.startActiveSpan(
      'intent.submission.queue',
      {
        attributes: {
          'intent.hash': intent.intentHash,
          'queue.strategy': strategyName,
        },
      },
      async (span) => {
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
      },
    );
  }
}
