import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { RhinestoneConfigService } from '@/modules/config/services/rhinestone-config.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { IQueueService } from '@/modules/queue/interfaces/queue-service.interface';

import { ActionStatusError } from '../types/action-status.types';
import { RelayerActionV1 } from '../types/relayer-action.types';
import { decodeAdapterClaim, decodeAdapterFill } from '../utils/decoder';
import { extractIntent } from '../utils/intent-extractor';
import { isValidHexData, normalizeError } from '../utils/validation';

import { RhinestoneValidationService } from './rhinestone-validation.service';
import { RhinestoneWebsocketService } from './rhinestone-websocket.service';

/**
 * Processes RelayerAction events and sends ActionStatus responses within 3 seconds
 */
@Injectable()
export class RhinestoneActionProcessor {
  private readonly logger = new Logger(RhinestoneActionProcessor.name);

  constructor(
    private readonly websocketService: RhinestoneWebsocketService,
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
    private readonly otelService: OpenTelemetryService,
    private readonly rhinestoneConfig: RhinestoneConfigService,
    private readonly validationService: RhinestoneValidationService,
  ) {}

  /**
   * Handle RelayerAction events (must respond within 3 seconds)
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

        try {
          const beforeFillClaim = payload.action.claims.find((claim) => claim.beforeFill === true);
          if (!beforeFillClaim) {
            throw new Error('No beforeFill claim found in RelayerAction');
          }

          if (!payload.action.fill) {
            throw new Error('No fill found in RelayerAction');
          }

          this.validationService.validateSettlementLayerFromMetadata(beforeFillClaim.metadata);
          this.validationService.validateActionIntegrity(
            beforeFillClaim.call,
            payload.action.fill.call,
          );

          const intent = this.extractIntent(beforeFillClaim, payload.action.fill);
          this.logger.log(`Extracted intent: ${intent.intentHash}`);
          console.log(
            `[RhinestoneActionProcessor] Intent details: ${JSON.stringify({
              intentHash: intent.intentHash,
              portal: intent.route.portal,
              prover: intent.reward.prover,
              sourceChain: intent.sourceChainId.toString(),
              destination: intent.destination.toString(),
              routeTokens: intent.route.tokens.map((t) => ({
                token: t.token,
                amount: t.amount.toString(),
              })),
              rewardTokens: intent.reward.tokens.map((t) => ({
                token: t.token,
                amount: t.amount.toString(),
              })),
              routeNativeAmount: intent.route.nativeAmount.toString(),
              rewardNativeAmount: intent.reward.nativeAmount.toString(),
            })}`,
          );
          span.setAttribute('rhinestone.intent_hash', intent.intentHash);

          span.setStatus({ code: api.SpanStatusCode.OK });

          await this.queueService.addIntentToFulfillmentQueue(intent);
        } catch (error) {
          const duration = Date.now() - startTime;

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

          span.recordException(normalizeError(error));
          span.setAttribute('rhinestone.processing_duration_ms', duration);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Extract intent from RelayerAction (decodes adapter claim and fill)
   */
  private extractIntent(
    beforeFillClaim: RelayerActionV1['claims'][0],
    fillAction: RelayerActionV1['fill'],
  ): Intent {
    if (!beforeFillClaim.call.data) {
      throw new Error('Claim call data is missing');
    }

    if (!fillAction.call.data) {
      throw new Error('Fill call data is missing');
    }

    const claimCallData = beforeFillClaim.call.data;

    if (!isValidHexData(claimCallData)) {
      throw new Error('Claim call data is not a valid hex string');
    }

    const claimData = decodeAdapterClaim(claimCallData);
    const fillData = decodeAdapterFill(fillAction.call.data);

    return extractIntent({ claimData, fillData });
  }
}
