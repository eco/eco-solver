import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import * as api from '@opentelemetry/api';

import { IntentFundedEvent } from '@/common/interfaces/events.interface';
import { IntentStatus } from '@/common/interfaces/intent.interface';
import { EcoLogMessage } from '@/common/logging/eco-log-message';
import { EcoLogger } from '@/common/logging/eco-logger';
import { getErrorMessage } from '@/common/utils/error-handler';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { IntentsService } from '@/modules/intents/intents.service';
import { Intent } from '@/modules/intents/schemas/intent.schema';
import { IntentConverter } from '@/modules/intents/utils/intent-converter';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

/**
 * Handler for IntentFunded blockchain events
 *
 * This handler processes IntentFunded events emitted when an intent is funded on the source chain.
 * It updates the intent status to FUNDED and stores relevant event metadata.
 *
 * Flow:
 * 1. Blockchain emits IntentFunded event
 * 2. BlockchainEventsProcessor parses and emits 'intent.funded'
 * 3. This handler catches the event and updates the database
 */
@Injectable()
export class IntentFundedHandler {
  private logger = new EcoLogger(IntentFundedHandler.name);

  constructor(
    private readonly intentsService: IntentsService,
    private readonly fulfillmentService: FulfillmentService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  @OnEvent('intent.funded', { async: true })
  async handleIntentFunded(event: IntentFundedEvent): Promise<void> {
    return this.otelService.tracer.startActiveSpan(
      'fulfillment.handler.intentFunded',
      {
        attributes: {
          'intent.hash': event.intentHash,
          'intent.funder': event.funder,
          'intent.complete': event.complete,
          'intent.chain_id': event.chainId.toString(),
          'intent.transaction_hash': event.transactionHash,
          'intent.block_number': event.blockNumber?.toString(),
        },
      },
      async (span) => {
        try {
          const intentHash = event.intentHash;

          this.logger.log(
            EcoLogMessage.fromDefault({
              message: `handleIntentFunded`,
              properties: {
                chainID: event.chainId,
                intentHash,
                transactionHash: event.transactionHash,
              },
            }),
          );

          // Update intent with funded event data and set status to FUNDED
          const updatedIntent = await this.updateIntent(event, span);

          // Submit intent to fulfillment service
          if (updatedIntent) {
            await this.submitIntent(updatedIntent, span);
          }

          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (ex) {
          const errorMessage = getErrorMessage(ex);

          this.logger.error(
            EcoLogMessage.fromDefault({
              message: `Error processing IntentFunded event for ${event.intentHash}`,
              properties: {
                intentHash: event.intentHash,
                error: errorMessage,
              },
            }),
          );

          span.recordException(ex as Error);
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: errorMessage,
          });

          throw ex;
        } finally {
          span.end();
        }
      },
    );
  }

  private async updateIntent(event: IntentFundedEvent, span: api.Span): Promise<Intent | null> {
    const intentHash = event.intentHash;
    const updatedIntent = await this.intentsService.updateFundedEvent(event);

    if (updatedIntent) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `updateIntent: Successfully updated intent ${intentHash} with funded event data.`,
          properties: {
            funder: event.funder,
            complete: event.complete,
            txHash: event.transactionHash,
          },
        }),
      );

      span.addEvent('intent.funded.updated', {
        status: IntentStatus.FUNDED,
        funder: event.funder,
        complete: event.complete,
        txHash: event.transactionHash,
      });

      return updatedIntent;
    }

    this.logger.warn(
      EcoLogMessage.fromDefault({
        message: `updateIntent: Intent ${intentHash} not found in database for IntentFunded event`,
      }),
    );

    span.addEvent('intent.not_found', {
      intentHash,
    });

    return null;
  }

  private async submitIntent(intent: Intent, span: api.Span): Promise<void> {
    const intentHash = intent.intentHash;

    try {
      const interfaceIntent = IntentConverter.toInterface(intent);
      await this.fulfillmentService.submitIntent(interfaceIntent);

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Intent ${intentHash} submitted to fulfillment queue`,
        }),
      );

      span.addEvent('intent.funded.submitted', {
        intentHash,
      });
    } catch (ex) {
      const errorMessage = getErrorMessage(ex);

      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Failed to submit intent ${intentHash} to fulfillment queue`,
          properties: {
            intentHash,
            error: errorMessage,
          },
        }),
      );

      span.addEvent('intent.funded.submit_error', {
        intentHash,
        message: errorMessage,
      });

      throw ex;
    }
  }
}
