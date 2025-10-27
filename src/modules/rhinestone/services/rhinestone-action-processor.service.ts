import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { IQueueService } from '@/modules/queue/interfaces/queue-service.interface';

import { ActionStatusError } from '../types/action-status.types';
import { RelayerActionV1 } from '../types/relayer-action.types';

import { RhinestoneWebsocketService } from './rhinestone-websocket.service';

/**
 * Processes RelayerAction events and sends ActionStatus responses
 *
 * Receives RelayerAction events from RhinestoneWebsocketService,
 * extracts intents, validates them, queues for fulfillment,
 * and sends ActionStatus response to Rhinestone within 3 seconds.
 */
@Injectable()
export class RhinestoneActionProcessor {
  private readonly logger = new Logger(RhinestoneActionProcessor.name);

  constructor(
    private readonly websocketService: RhinestoneWebsocketService,
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  /**
   * Handle RelayerAction events
   * Must send ActionStatus response within 3 seconds
   */
  @OnEvent('rhinestone.relayerAction')
  async handleRelayerAction(payload: {
    messageId: string;
    action: RelayerActionV1;
  }): Promise<void> {
    return this.otelService.tracer.startActiveSpan(
      'rhinestone.action_processor.handle',
      {
        attributes: {
          'rhinestone.message_id': payload.messageId,
          'rhinestone.action_id': payload.action.id,
          'rhinestone.action_timestamp': payload.action.timestamp,
        },
      },
      async (span) => {
        const startTime = Date.now();
        this.logger.log(`Processing RelayerAction ${payload.messageId}`);

        try {
          // Extract intent from action
          const intent = await this.extractIntent(payload.action);
          span.setAttribute('rhinestone.intent_hash', intent.intentHash);

          this.logger.log(`Extracted intent: ${intent.intentHash}`);

          // Queue intent for fulfillment
          this.logger.log('Queueing intent to fulfillment');
          await this.queueService.addIntentToFulfillmentQueue(intent, 'rhinestone');

          // Send success response
          await this.websocketService.sendActionStatus(payload.messageId, {
            type: 'Success',
            preconfirmation: {
              txId: '0x0000000000000000000000000000000000000000000000000000000000000000', // Placeholder
            },
          });

          const duration = Date.now() - startTime;
          this.logger.log(`Successfully processed ${payload.messageId} in ${duration}ms`);
          span.setAttribute('rhinestone.processing_duration_ms', duration);
          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (error) {
          const duration = Date.now() - startTime;
          this.logger.error(`Failed to process ${payload.messageId}: ${error}`);

          // Send error response
          const errorStatus: ActionStatusError = {
            type: 'Error',
            reason: 'PreconditionFailed',
            message: error instanceof Error ? error.message : String(error),
          };

          try {
            await this.websocketService.sendActionStatus(payload.messageId, errorStatus);
          } catch (sendError) {
            this.logger.error(`Failed to send error ActionStatus: ${sendError}`);
          }

          span.recordException(error as Error);
          span.setAttribute('rhinestone.processing_duration_ms', duration);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Extract intent from RelayerAction
   *
   * REFERENCE: Solver V1 implementation at:
   * - /Users/elio/Documents/eco-solver/src/rhinestone/services/rhinestone-validator.service.ts
   * - /Users/elio/Documents/eco-solver/src/rhinestone/utils/intent-extractor.ts
   * - /Users/elio/Documents/eco-solver/src/rhinestone/utils/decoder.ts
   *
   * TODO: Port V1 intent extraction logic
   * For now, always returns error to trigger Error ActionStatus response
   */
  private async extractIntent(_action: RelayerActionV1): Promise<Intent> {
    throw new Error('Intent extraction not yet implemented');
  }
}
