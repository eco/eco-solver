import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import * as api from '@opentelemetry/api';
import { Hex, keccak256 } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { IQueueService } from '@/modules/queue/interfaces/queue-service.interface';

import { ActionStatusError } from '../types/action-status.types';
import { RelayerActionV1 } from '../types/relayer-action.types';
import { decodeAdapterClaim } from '../utils/decoder';
import { extractIntent } from '../utils/intent-extractor';

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
   * Process flow:
   * 1. Find the claim with beforeFill=true (reward claim)
   * 2. Decode the adapter call data to extract ClaimData
   * 3. Compute claim hash from the call data
   * 4. Extract Intent from ClaimData using intent-extractor
   */
  private async extractIntent(action: RelayerActionV1): Promise<Intent> {
    // Find the beforeFill claim (this contains the reward/order data)
    const beforeFillClaim = action.claims.find((claim) => claim.beforeFill === true);

    if (!beforeFillClaim) {
      throw new Error('No beforeFill claim found in RelayerAction');
    }

    // Decode the adapter claim to get ClaimData
    const claimCallData = beforeFillClaim.call.data as Hex;
    const claimData = decodeAdapterClaim(claimCallData);

    // Compute claim hash (hash of the raw call data)
    const claimHash = keccak256(claimCallData);

    // Extract source chain from the claim call
    const sourceChainId = beforeFillClaim.call.chainId;

    // Extract intent using our utility
    const intent = extractIntent(claimData, claimHash, sourceChainId);

    return intent;
  }
}
