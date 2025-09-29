import { Injectable, OnModuleInit } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import {
  IntentFulfilledEvent,
  IntentProvenEvent,
  IntentWithdrawnEvent,
} from '@/common/interfaces/events.interface';
import { toError } from '@/common/utils/error-handler';
import { EventsService } from '@/modules/events/events.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { IntentsService } from './intents.service';

@Injectable()
export class IntentsEventsHandler implements OnModuleInit {
  constructor(
    private readonly eventsService: EventsService,
    private readonly intentsService: IntentsService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
  ) {
    this.logger.setContext(IntentsEventsHandler.name);
  }

  onModuleInit() {
    // Subscribe to IntentFulfilled events
    this.eventsService.on('intent.fulfilled', async (event: IntentFulfilledEvent) => {
      await this.handleIntentFulfilled(event);
    });

    // Subscribe to IntentProven events
    this.eventsService.on('intent.proven', async (event: IntentProvenEvent) => {
      await this.handleIntentProven(event);
    });

    // Subscribe to IntentWithdrawn events
    this.eventsService.on('intent.withdrawn', async (event: IntentWithdrawnEvent) => {
      await this.handleIntentWithdrawn(event);
    });

    this.logger.log('Intent event handlers registered');
  }

  /**
   * Handle IntentFulfilled event by updating the intent record
   */
  private async handleIntentFulfilled(event: IntentFulfilledEvent): Promise<void> {
    await this.otelService.tracer.startActiveSpan(
      'intents.events.handleIntentFulfilled',
      {
        attributes: {
          'intent.hash': event.intentHash,
          'event.chain_id': event.chainId.toString(),
          'event.transaction_hash': event.transactionHash,
          'event.claimant': event.claimant,
        },
      },
      async (span) => {
        try {
          this.logger.log(`Processing IntentFulfilled event for intent ${event.intentHash}`);

          // Update the intent with fulfilled event data
          const updatedIntent = await this.intentsService.updateFulfilledEvent(event);

          if (updatedIntent) {
            this.logger.log(
              `Successfully updated intent ${event.intentHash} with fulfilled event data`,
            );
            span.setAttribute('update.success', true);
          } else {
            this.logger.warn(`Intent ${event.intentHash} not found for fulfilled event update`);
            span.setAttribute('update.success', false);
            span.setAttribute('update.reason', 'intent_not_found');
          }

          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (error) {
          this.logger.error(
            `Failed to handle IntentFulfilled event for ${event.intentHash}`,
            toError(error),
          );
          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        }
      },
    );
  }

  /**
   * Handle IntentProven event by updating the intent record
   */
  private async handleIntentProven(event: IntentProvenEvent): Promise<void> {
    await this.otelService.tracer.startActiveSpan(
      'intents.events.handleIntentProven',
      {
        attributes: {
          'intent.hash': event.intentHash,
          'event.chain_id': event.chainId.toString(),
          'event.transaction_hash': event.transactionHash,
          'event.claimant': event.claimant,
        },
      },
      async (span) => {
        try {
          this.logger.log(`Processing IntentProven event for intent ${event.intentHash}`);

          // Update the intent with proven event data
          const updatedIntent = await this.intentsService.updateProvenEvent(event);

          if (updatedIntent) {
            this.logger.log(
              `Successfully updated intent ${event.intentHash} with proven event data`,
            );
            span.setAttribute('update.success', true);
          } else {
            this.logger.warn(`Intent ${event.intentHash} not found for proven event update`);
            span.setAttribute('update.success', false);
            span.setAttribute('update.reason', 'intent_not_found');
          }

          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (error) {
          this.logger.error(
            `Failed to handle IntentProven event for ${event.intentHash}`,
            toError(error),
          );
          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        }
      },
    );
  }

  /**
   * Handle IntentWithdrawn event by updating the intent record
   */
  private async handleIntentWithdrawn(event: IntentWithdrawnEvent): Promise<void> {
    await this.otelService.tracer.startActiveSpan(
      'intents.events.handleIntentWithdrawn',
      {
        attributes: {
          'intent.hash': event.intentHash,
          'event.chain_id': event.chainId.toString(),
          'event.transaction_hash': event.transactionHash,
          'event.claimant': event.claimant,
        },
      },
      async (span) => {
        try {
          this.logger.log(`Processing IntentWithdrawn event for intent ${event.intentHash}`);

          // Update the intent with withdrawn event data
          const updatedIntent = await this.intentsService.updateWithdrawnEvent(event);

          if (updatedIntent) {
            this.logger.log(
              `Successfully updated intent ${event.intentHash} with withdrawn event data`,
            );
            span.setAttribute('update.success', true);
          } else {
            this.logger.warn(`Intent ${event.intentHash} not found for withdrawn event update`);
            span.setAttribute('update.success', false);
            span.setAttribute('update.reason', 'intent_not_found');
          }

          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (error) {
          this.logger.error(
            `Failed to handle IntentWithdrawn event for ${event.intentHash}`,
            toError(error),
          );
          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        }
      },
    );
  }
}
