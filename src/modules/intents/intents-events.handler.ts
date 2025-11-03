import { Injectable, OnModuleInit } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import {
  IntentFulfilledEvent,
  IntentProvenEvent,
  IntentWithdrawnEvent,
} from '@/common/interfaces/events.interface';
import { EventsService } from '@/modules/events/events.service';
import { Logger } from '@/modules/logging';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { IntentsService } from './intents.service';

@Injectable()
export class IntentsEventsHandler implements OnModuleInit {
  constructor(
    private readonly logger: Logger,
    private readonly eventsService: EventsService,
    private readonly intentsService: IntentsService,
    private readonly otelService: OpenTelemetryService,
  ) {}

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

    this.logger.info('Intent event handlers registered');
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
          this.logger.info('Processing IntentFulfilled event', {
            intentHash: event.intentHash,
            chainId: event.chainId.toString(),
            transactionHash: event.transactionHash,
          });

          // Update the intent with fulfilled event data
          const updatedIntent = await this.intentsService.updateFulfilledEvent(event);

          if (updatedIntent) {
            this.logger.info('Successfully updated intent with fulfilled event data', {
              intentHash: event.intentHash,
            });
            span.setAttribute('update.success', true);
          } else {
            this.logger.warn('Intent not found for fulfilled event update', {
              intentHash: event.intentHash,
            });
            span.setAttribute('update.success', false);
            span.setAttribute('update.reason', 'intent_not_found');
          }

          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (error) {
          this.logger.error('Failed to handle IntentFulfilled event', error, {
            intentHash: event.intentHash,
          });
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
          this.logger.info('Processing IntentProven event', {
            intentHash: event.intentHash,
            chainId: event.chainId.toString(),
            transactionHash: event.transactionHash,
          });

          // Update the intent with proven event data
          const updatedIntent = await this.intentsService.updateProvenEvent(event);

          if (updatedIntent) {
            this.logger.info('Successfully updated intent with proven event data', {
              intentHash: event.intentHash,
            });
            span.setAttribute('update.success', true);
          } else {
            this.logger.warn('Intent not found for proven event update', {
              intentHash: event.intentHash,
            });
            span.setAttribute('update.success', false);
            span.setAttribute('update.reason', 'intent_not_found');
          }

          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (error) {
          this.logger.error('Failed to handle IntentProven event', error, {
            intentHash: event.intentHash,
          });
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
          this.logger.info('Processing IntentWithdrawn event', {
            intentHash: event.intentHash,
            chainId: event.chainId.toString(),
            transactionHash: event.transactionHash,
          });

          // Update the intent with withdrawn event data
          const updatedIntent = await this.intentsService.updateWithdrawnEvent(event);

          if (updatedIntent) {
            this.logger.info('Successfully updated intent with withdrawn event data', {
              intentHash: event.intentHash,
            });
            span.setAttribute('update.success', true);
          } else {
            this.logger.warn('Intent not found for withdrawn event update', {
              intentHash: event.intentHash,
            });
            span.setAttribute('update.success', false);
            span.setAttribute('update.reason', 'intent_not_found');
          }

          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (error) {
          this.logger.error('Failed to handle IntentWithdrawn event', error, {
            intentHash: event.intentHash,
          });
          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        }
      },
    );
  }
}
