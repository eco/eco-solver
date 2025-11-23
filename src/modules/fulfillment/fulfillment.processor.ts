import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { Job, UnrecoverableError } from 'bullmq';

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

import { FulfillmentJobData } from './interfaces/fulfillment-job.interface';

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
    if (job.name === 'process-intent') {
      const jobData = BigintSerializer.deserialize<FulfillmentJobData>(job.data);

      this.logger.log(
        `Processing intent ${jobData.intent.intentHash} with strategy ${jobData.strategy} (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`,
      );

      // Check database for fulfilledEvent to catch race conditions
      // Also ensures we have the freshest intent data
      const dbIntent = await this.intentsService.findById(jobData.intent.intentHash);
      if (dbIntent?.fulfilledEvent) {
        this.logger.log(
          `Intent ${jobData.intent.intentHash} has already been fulfilled on chain ${dbIntent.fulfilledEvent.chainId} at tx ${dbIntent.fulfilledEvent.txHash}. Skipping processing.`,
        );
        return;
      }

      // Use fresh DB intent instead of potentially stale job data
      const intentToProcess = dbIntent || jobData.intent;

      // Break context and start a new trace for fulfillment stage
      return this.otelService.startNewTraceWithCorrelation(
        'fulfillment.process',
        intentToProcess.intentHash,
        'fulfillment',
        async (span) => {
          span.setAttributes({
            'fulfillment.strategy': jobData.strategy,
            'fulfillment.attempt': job.attemptsMade + 1,
            'fulfillment.max_attempts': job.opts.attempts,
            'intent.source_chain': intentToProcess.sourceChainId?.toString() || 'unknown',
            'intent.destination_chain': intentToProcess.destination.toString(),
          });

          try {
            await this.fulfillmentService.processIntent(intentToProcess, jobData.strategy);
          } catch (error) {
            // Handle ValidationError and AggregatedValidationError
            if (error instanceof ValidationError) {
              // Update intent with error information
              await this.intentsService.updateStatus(
                jobData.intent.intentHash,
                jobData.intent.status!,
                {
                  retryCount: job.attemptsMade + 1,
                  lastError: {
                    message: error.message,
                    errorType: error.type,
                    timestamp: new Date(),
                  },
                  lastProcessedAt: new Date(),
                },
              );

              // Log the error details
              const errorDetails =
                error instanceof AggregatedValidationError
                  ? `(aggregated with ${error.individualErrors.length} failures)`
                  : '';

              this.logger.warn(
                `Validation error for intent ${jobData.intent.intentHash}: ${error.message} ${errorDetails} (type: ${error.type}, attempt: ${job.attemptsMade + 1})`,
              );

              // Check if this is a PERMANENT error that should not be retried
              if (error.type === ValidationErrorType.PERMANENT) {
                this.logger.error(
                  `Permanent validation failure for intent ${jobData.intent.intentHash} - stopping retries`,
                );
                // Throw UnrecoverableError to prevent BullMQ from retrying
                throw new UnrecoverableError(error.message);
              }

              // For TEMPORARY errors, re-throw to allow BullMQ retry with backoff
              this.logger.log(
                `Temporary validation failure for intent ${jobData.intent.intentHash} - will retry with backoff`,
              );
              throw error;
            } else {
              // For non-ValidationError errors, log and re-throw normally
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
    return;
  }
}
