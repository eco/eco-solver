import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { Address, Hex } from 'viem';

import { FULFILLMENT_STRATEGY_NAMES } from '@/modules/fulfillment/types/strategy-name.type';
import { IntentsService } from '@/modules/intents/intents.service';
import { OpenTelemetryService } from '@/modules/opentelemetry';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { RhinestonePayload } from '@/modules/queue/interfaces/execution-job.interface';
import { IQueueService } from '@/modules/queue/interfaces/queue-service.interface';

import { RelayerActionV1 } from '../types/relayer-action.types';
import { decodeAdapterClaim, decodeAdapterFill } from '../utils/decoder';
import { extractIntent } from '../utils/intent-extractor';

import { RhinestoneMetadataService } from './rhinestone-metadata.service';
import { RhinestoneValidationService } from './rhinestone-validation.service';
import { RhinestoneWebsocketService } from './rhinestone-websocket.service';

/**
 * Processes RelayerAction events and queues to FulfillmentQueue
 *
 * Flow: Validate → Extract Intent → Store in DB → Queue to FulfillmentQueue → Strategy validates → Execute
 * Rhinestone flow: CLAIM (Base) → FILL (Arbitrum) → PROVE (Arbitrum→Base) → WITHDRAW (via existing system)
 */
@Injectable()
export class RhinestoneActionProcessor {
  private readonly logger = new Logger(RhinestoneActionProcessor.name);

  constructor(
    private readonly websocketService: RhinestoneWebsocketService,
    private readonly otelService: OpenTelemetryService,
    private readonly validationService: RhinestoneValidationService,
    private readonly intentsService: IntentsService,
    private readonly metadataService: RhinestoneMetadataService,
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
  ) {}

  /**
   * Handle RelayerAction events from Rhinestone WebSocket
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
        try {
          // 1. Validate
          const claim = payload.action.claims.find((c) => c.beforeFill === true);
          const fill = payload.action.fill;

          if (!claim) {
            throw new Error('No beforeFill claim found in RelayerAction');
          }

          if (!fill) {
            throw new Error('No fill found in RelayerAction');
          }

          this.validationService.validateSettlementLayerFromMetadata(claim.metadata);
          this.validationService.validateActionIntegrity(claim.call, fill.call);

          // 2. Extract intent
          const claimData = decodeAdapterClaim(claim.call.data as Hex);
          const fillData = decodeAdapterFill(fill.call.data as Hex);
          const intent = extractIntent({ claimData, fillData });

          this.logger.log(`Extracted Rhinestone intent: ${intent.intentHash}`);
          span.setAttribute('rhinestone.intent_hash', intent.intentHash);

          // 3. Store in DB (duplicate detection)
          const { isNew } = await this.intentsService.createIfNotExists(intent);

          if (!isNew) {
            this.logger.log(`Duplicate Rhinestone intent: ${intent.intentHash}`);
            return;
          }

          // 4. Prepare Rhinestone payload
          const rhinestonePayload: RhinestonePayload = {
            messageId: payload.messageId,
            claimTo: claim.call.to as Address,
            claimData: claim.call.data as Hex,
            claimValue: BigInt(claim.call.value),
            fillTo: fill.call.to as Address,
            fillData: fill.call.data as Hex,
            fillValue: BigInt(fill.call.value),
          };

          this.logger.log('Rhinestone payload:', {
            claimTo: rhinestonePayload.claimTo,
            claimData: rhinestonePayload.claimData,
            claimValue: rhinestonePayload.claimValue.toString(),
            fillTo: rhinestonePayload.fillTo,
            fillData: rhinestonePayload.fillData,
            fillValue: rhinestonePayload.fillValue.toString,
          });

          // 5. Store payload in Redis (strategy will retrieve it)
          await this.metadataService.set(intent.intentHash, rhinestonePayload);

          this.logger.log('Rhinestone payload stored in Redis');

          // 6. Queue to FulfillmentQueue (validations will run in strategy)
          await this.queueService.addIntentToFulfillmentQueue(
            intent,
            FULFILLMENT_STRATEGY_NAMES.RHINESTONE,
          );

          this.logger.log(`Queued Rhinestone intent to FulfillmentQueue: ${intent.intentHash}`);

          // TODO: For now, we queue and don't send immediate status
          // Later we can implement async status updates when execution completes
        } catch (error) {
          this.logger.error(
            `Rhinestone action failed: ${error instanceof Error ? error.message : String(error)}`,
          );

          // Send error status back to Rhinestone
          await this.websocketService.sendActionStatus(payload.messageId, {
            type: 'Error',
            reason: 'PreconditionFailed',
            message: error instanceof Error ? error.message : String(error),
          });

          span.recordException(error as Error);
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }
}
