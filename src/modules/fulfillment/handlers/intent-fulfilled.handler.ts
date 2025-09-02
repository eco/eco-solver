import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import * as api from '@opentelemetry/api';

import { IntentFulfilledEvent } from '@/common/interfaces/events.interface';
import { IntentStatus } from '@/common/interfaces/intent.interface';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { IntentsService } from '@/modules/intents/intents.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

@Injectable()
export class IntentFulfilledHandler {
  constructor(
    private readonly intentsService: IntentsService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
  ) {
    this.logger.setContext(IntentFulfilledHandler.name);
  }

  @OnEvent('intent.fulfilled', { async: true })
  async handleIntentFulfilled(event: IntentFulfilledEvent): Promise<void> {
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('fulfillment.handler.intentFulfilled', {
        attributes: {
          'intent.hash': event.intentHash,
          'intent.claimant': event.claimant,
          'intent.chain_id': event.chainId.toString(),
          'intent.tx_hash': event.transactionHash,
          'intent.block_number': event.blockNumber?.toString(),
        },
      });

    try {
      this.logger.log(
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
        this.logger.log(
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

      if (!activeSpan) {
        span.setStatus({ code: api.SpanStatusCode.OK });
      }
    } catch (error) {
      this.logger.error(
        `Error processing IntentFulfilled event for ${event.intentHash}: ${getErrorMessage(error)}`,
        toError(error),
      );

      if (!activeSpan) {
        span.recordException(error as Error);
        span.setStatus({
          code: api.SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
      }

      throw error;
    } finally {
      if (!activeSpan) {
        span.end();
      }
    }
  }
}
