import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { Address, Hex } from 'viem';

import { IntentsService } from '@/modules/intents/intents.service';
import { OpenTelemetryService } from '@/modules/opentelemetry';
import { QueueService } from '@/modules/queue/queue.service';

import { RelayerActionV1 } from '../types/relayer-action.types';
import { decodeAdapterClaim, decodeAdapterFills } from '../utils/decoder';
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
    private readonly queueService: QueueService,
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
          const { messageId, action } = payload;
          const beforeFillClaims = action.claims.filter((c) => c.beforeFill === true);
          const fill = action.fill;

          this.logger.log(`Processing Rhinestone action: ${messageId}`);

          if (beforeFillClaims.length === 0) {
            throw new Error('No beforeFill claims found in RelayerAction');
          }

          if (!fill) {
            throw new Error('No fill found in RelayerAction');
          }

          // Decode all fills from batched transaction
          const fillsData = decodeAdapterFills(fill.call.data as Hex);

          this.logger.log(
            `Decoded ${fillsData.length} batched eco_handleFill calls from fill transaction`,
          );

          // Process each claim and extract intent
          const claimsWithIntents = await Promise.all(
            beforeFillClaims
              .filter((c) => c.metadata?.settlementLayer === 'ECO')
              .map(async (claim, index) => {
                this.validationService.validateSettlementLayerFromMetadata(claim.metadata);
                this.validationService.validateActionIntegrity(claim.call, fill.call);

                const claimData = decodeAdapterClaim(claim.call.data as Hex);
                const fillData = fillsData[index];
                const intent = extractIntent({ claimData, fillData });

                this.logger.log(`Extracted intent: ${intent.intentHash} from claim ${index + 1}`);

                return {
                  intent,
                  intentHash: intent.intentHash,
                  chainId: BigInt(claim.call.chainId),
                  transaction: {
                    to: claim.call.to as Address,
                    data: claim.call.data as Hex,
                    value: BigInt(claim.call.value),
                  },
                };
              }),
          );

          span.setAttribute('rhinestone.intents_extracted', claimsWithIntents.length);

          // Store all intents in database
          for (const { intent } of claimsWithIntents) {
            const { isNew } = await this.intentsService.createIfNotExists(intent);

            if (!isNew) {
              this.logger.warn(`Intent ${intent.intentHash} already exists - may be retry`);
            }
          }

          // Pre-calculate token approval amounts from decoded fills
          const tokenAmountsMap = new Map<string, bigint>();

          for (const fillData of fillsData) {
            for (const { token, amount } of fillData.route.tokens) {
              const current = tokenAmountsMap.get(token) || 0n;
              tokenAmountsMap.set(token, current + amount);
            }
          }

          const requiredApprovals = Array.from(tokenAmountsMap.entries()).map(
            ([token, amount]) => ({
              token: token as Address,
              amount,
            }),
          );

          this.logger.log(`Calculated ${requiredApprovals.length} token approvals`);

          // Build claims for flow
          const claims = claimsWithIntents.map((c) => ({
            intentHash: c.intentHash,
            chainId: c.chainId,
            transaction: c.transaction,
          }));

          // Build fill data with pre-calculated approvals
          const fillParams = {
            intents: claimsWithIntents.map((c) => c.intent),
            chainId: BigInt(fill.call.chainId),
            transaction: {
              to: fill.call.to as Address,
              data: fill.call.data as Hex,
              value: BigInt(fill.call.value),
            },
            requiredApprovals,
          };

          // Queue multiclaim flow
          await this.queueService.addRhinestoneMulticlaimFlow({
            messageId,
            actionId: action.id,
            claims,
            fill: fillParams,
            walletId: 'basic',
          });

          this.logger.log(`Rhinestone multiclaim flow queued: ${messageId}`);
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
