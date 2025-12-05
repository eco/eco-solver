import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Job, UnrecoverableError } from 'bullmq';

import { IntentStatus } from '@/common/interfaces/intent.interface';
import { BigintSerializer } from '@/common/utils/bigint-serializer';
import { toError } from '@/common/utils/error-handler';
import { ValidationErrorType } from '@/modules/fulfillment/enums/validation-error-type.enum';
import { AggregatedValidationError } from '@/modules/fulfillment/errors/aggregated-validation.error';
import { ValidationError } from '@/modules/fulfillment/errors/validation.error';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { IntentsService } from '@/modules/intents/intents.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { BullMQOtelFactory } from '@/modules/opentelemetry/bullmq-otel.factory';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';

import { RHINESTONE_EVENTS } from '../rhinestone/types/events.types';

import {
  RhinestoneActionFulfillmentJob,
  StandardFulfillmentJob,
} from './interfaces/fulfillment-job.interface';

@Processor(QueueNames.INTENT_FULFILLMENT, {
  prefix: `{${QueueNames.INTENT_FULFILLMENT}}`,
})
export class FulfillmentProcessor extends WorkerHost implements OnModuleInit, OnModuleDestroy {
  constructor(
    private fulfillmentService: FulfillmentService,
    private intentsService: IntentsService,
    private readonly logger: SystemLoggerService,
    @Inject(BullMQOtelFactory) private bullMQOtelFactory: BullMQOtelFactory,
    private readonly otelService: OpenTelemetryService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
    this.logger.setContext(FulfillmentProcessor.name);
  }

  onModuleInit() {
    // Add telemetry if available
    if (this.worker) {
      const telemetry = this.bullMQOtelFactory.getInstance();
      if (telemetry && !this.worker.opts.telemetry) {
        this.worker.opts.telemetry = telemetry;
        this.logger.log('Added BullMQOtel telemetry to FulfillmentProcessor worker');
      }
    }
  }

  async onModuleDestroy() {
    // Close the worker to ensure clean shutdown
    if (this.worker) {
      this.logger.log('Closing FulfillmentProcessor worker...');
      await this.worker.close();
      this.logger.log('FulfillmentProcessor worker closed');
    }
  }

  async process(job: Job<string>) {
    switch (job.name) {
      case 'process-intent':
        return this.processStandardIntent(job);

      case 'process-rhinestone-action':
        return this.processRhinestoneAction(job);

      // TODO: remove this when Rhinestone uses fund instead of publishAndFund
      case 'rhinestone-deduplication':
        // Placeholder job for deduplication - ignore silently
        break;

      default:
        // Log unexpected job names for debugging
        this.logger.warn(`Unknown job name in FULFILLMENT queue: ${job.name}`);
    }
  }

  /**
   * Handle validation errors - common logic for logging and retry decisions
   * @param error The validation error
   * @param identifier Intent hash or action ID
   * @param jobAttempt Current attempt number
   * @throws UnrecoverableError for PERMANENT errors, re-throws for TEMPORARY
   */
  private handleValidationError(
    error: ValidationError,
    identifier: string,
    jobAttempt: number,
  ): never {
    // Log error details
    const errorDetails =
      error instanceof AggregatedValidationError
        ? `(aggregated with ${error.individualErrors.length} failures)`
        : '';

    this.logger.warn(
      `Validation error for ${identifier}: ${error.message} ${errorDetails} (type: ${error.type}, attempt: ${jobAttempt})`,
    );

    // Check if PERMANENT error - stop retries
    if (error.type === ValidationErrorType.PERMANENT) {
      this.logger.error(`Permanent validation failure for ${identifier} - stopping retries`);
      throw new UnrecoverableError(error.message);
    }

    // TEMPORARY error - allow retry
    this.logger.log(`Temporary validation failure for ${identifier} - will retry with backoff`);
    throw error;
  }

  /**
   * Update intent status with error information
   */
  private async updateIntentStatus(
    intentHash: string,
    status: IntentStatus,
    error: ValidationError,
    attemptsMade: number,
  ): Promise<void> {
    await this.intentsService.updateStatus(intentHash, status, {
      retryCount: attemptsMade + 1,
      lastError: {
        message: error.message,
        errorType: error.type,
        timestamp: new Date(),
      },
      lastProcessedAt: new Date(),
    });
  }

  /**
   * Process standard intent fulfillment job
   */
  private async processStandardIntent(job: Job<string>): Promise<void> {
    const jobData = BigintSerializer.deserialize<StandardFulfillmentJob>(job.data);

    this.logger.log(
      `Processing intent ${jobData.intent.intentHash} with strategy ${jobData.strategy} (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`,
    );

    return this.otelService.startNewTraceWithCorrelation(
      'fulfillment.process',
      jobData.intent.intentHash,
      'fulfillment',
      async (span) => {
        span.setAttributes({
          'fulfillment.strategy': jobData.strategy,
          'fulfillment.attempt': job.attemptsMade + 1,
          'fulfillment.max_attempts': job.opts.attempts,
          'intent.source_chain': jobData.intent.sourceChainId?.toString() || 'unknown',
          'intent.destination_chain': jobData.intent.destination.toString(),
        });

        try {
          await this.fulfillmentService.processIntent(jobData.intent, jobData.strategy);
        } catch (error) {
          if (error instanceof ValidationError) {
            await this.updateIntentStatus(
              jobData.intent.intentHash,
              jobData.intent.status!,
              error,
              job.attemptsMade,
            );

            this.handleValidationError(error, jobData.intent.intentHash, job.attemptsMade + 1);
          } else {
            // For non-ValidationError errors, log and re-throw
            this.logger.error(
              `Non-validation error processing intent ${jobData.intent.intentHash}:`,
              toError(error),
            );
            throw error;
          }
        }
      },
      {
        'fulfillment.job_id': job.id,
      },
    );
  }

  /**
   * Process Rhinestone action fulfillment job (multi-intent)
   */
  private async processRhinestoneAction(job: Job<string>): Promise<void> {
    const jobData = BigintSerializer.deserialize<RhinestoneActionFulfillmentJob>(job.data);

    this.logger.log(
      `Processing Rhinestone action ${jobData.actionId} with ${jobData.claims.length} claims (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`,
    );

    try {
      await this.fulfillmentService.processRhinestoneAction(jobData);
    } catch (error) {
      if (error instanceof ValidationError) {
        await Promise.all(
          jobData.claims.map((claim) =>
            this.updateIntentStatus(
              claim.intent.intentHash,
              claim.intent.status!,
              error,
              job.attemptsMade,
            ),
          ),
        );

        this.eventEmitter.emit(RHINESTONE_EVENTS.ACTION_FAILED, {
          messageId: jobData.messageId,
          actionId: jobData.actionId,
          error: error.message,
          errorType: error.type,
        });

        this.handleValidationError(error, jobData.actionId, job.attemptsMade + 1);
      } else {
        // For non-ValidationError errors, log and re-throw
        this.logger.error(
          `Non-validation error processing Rhinestone action ${jobData.actionId}:`,
          toError(error),
        );
        throw error;
      }
    }
  }
}
