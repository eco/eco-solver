import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import * as api from '@opentelemetry/api';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { IntentFulfilledEvent } from '@/common/interfaces/events.interface';
import { IntentStatus } from '@/common/interfaces/intent.interface';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { IntentsService } from '@/modules/intents/intents.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

@Injectable()
export class IntentFulfilledHandler {
  constructor(
    @InjectPinoLogger(IntentFulfilledHandler.name)
    private readonly logger: PinoLogger,
    private readonly intentsService: IntentsService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  @OnEvent('intent.fulfilled', { async: true })
  async handleIntentFulfilled(event: IntentFulfilledEvent): Promise<void> {
    return this.otelService.tracer.startActiveSpan(
      'fulfillment.handler.intentFulfilled',
      {
        attributes: {
          'intent.hash': event.intentHash,
          'intent.claimant': event.claimant,
          'intent.chain_id': event.chainId.toString(),
          'intent.transaction_hash': event.transactionHash,
          'intent.block_number': event.blockNumber?.toString(),
        },
      },
      async (span) => {
        try {
          this.logger.info(
            `Processing IntentFulfilled event for intent ${event.intentHash} on chain ${event.chainId}`,
          );

          // Update intent status to FULFILLED
          const updatedIntent = await this.intentsService.updateStatus(
            event.intentHash,
            IntentStatus.FULFILLED,
            {
              lastProcessedAt: new Date(),
            },
          );

          if (updatedIntent) {
            this.logger.info(
              `Successfully updated intent ${event.intentHash} status to FULFILLED. Tx: ${event.transactionHash}`,
            );

            span.addEvent('intent.status.updated', {
              status: IntentStatus.FULFILLED,
              txHash: event.transactionHash,
            });
          } else {
            this.logger.warn(
              `Intent ${event.intentHash} not found in database for IntentFulfilled event`,
            );

            span.addEvent('intent.not_found', {
              intentHash: event.intentHash,
            });
          }

          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (error) {
          this.logger.error(
            `Error processing IntentFulfilled event for ${event.intentHash}: ${getErrorMessage(error)}`,
            toError(error),
          );

          span.recordException(error as Error);
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: (error as Error).message,
          });

          throw error;
        } finally {
          span.end();
        }
      },
    );
  }
}
