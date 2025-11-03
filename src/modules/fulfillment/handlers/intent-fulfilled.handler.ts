import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import * as api from '@opentelemetry/api';

import { IntentFulfilledEvent } from '@/common/interfaces/events.interface';
import { IntentStatus } from '@/common/interfaces/intent.interface';
import { IntentsService } from '@/modules/intents/intents.service';
import { Logger } from '@/modules/logging';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

@Injectable()
export class IntentFulfilledHandler {
  constructor(
    private readonly logger: Logger,
    private readonly intentsService: IntentsService,
    private readonly otelService: OpenTelemetryService,
  ) {
    this.logger.setContext(IntentFulfilledHandler.name);
  }

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
          this.logger.info('Processing IntentFulfilled event', {
            intentHash: event.intentHash,
            chainId: event.chainId.toString(),
            claimant: event.claimant,
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber?.toString(),
          });

          // Update intent status to FULFILLED
          const updatedIntent = await this.intentsService.updateStatus(
            event.intentHash,
            IntentStatus.FULFILLED,
            {
              lastProcessedAt: new Date(),
            },
          );

          if (updatedIntent) {
            this.logger.info('Successfully updated intent status to FULFILLED', {
              intentHash: event.intentHash,
              transactionHash: event.transactionHash,
              chainId: event.chainId.toString(),
            });

            span.addEvent('intent.status.updated', {
              status: IntentStatus.FULFILLED,
              txHash: event.transactionHash,
            });
          } else {
            this.logger.warn('Intent not found in database for IntentFulfilled event', {
              intentHash: event.intentHash,
              chainId: event.chainId.toString(),
              transactionHash: event.transactionHash,
            });

            span.addEvent('intent.not_found', {
              intentHash: event.intentHash,
            });
          }

          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (error) {
          this.logger.error('Error processing IntentFulfilled event', error, {
            intentHash: event.intentHash,
            chainId: event.chainId.toString(),
            transactionHash: event.transactionHash,
          });

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
