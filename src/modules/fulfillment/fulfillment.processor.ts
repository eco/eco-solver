import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Optional } from '@nestjs/common';

import { Job, UnrecoverableError } from 'bullmq';

import { BigintSerializer } from '@/common/utils/bigint-serializer';
import { toError } from '@/common/utils/error-handler';
import { ValidationErrorType } from '@/modules/fulfillment/enums/validation-error-type.enum';
import { AggregatedValidationError } from '@/modules/fulfillment/errors/aggregated-validation.error';
import { ValidationError } from '@/modules/fulfillment/errors/validation.error';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { IntentsService } from '@/modules/intents/intents.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { QueueTracingService } from '@/modules/opentelemetry/queue-tracing.service';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';

import { FulfillmentJobData } from './interfaces/fulfillment-job.interface';

@Processor(QueueNames.INTENT_FULFILLMENT, {
  prefix: `{${QueueNames.INTENT_FULFILLMENT}}`,
})
export class FulfillmentProcessor extends WorkerHost {
  constructor(
    private fulfillmentService: FulfillmentService,
    private intentsService: IntentsService,
    private readonly logger: SystemLoggerService,
    @Optional() private readonly queueTracing?: QueueTracingService,
  ) {
    super();
    this.logger.setContext(FulfillmentProcessor.name);
  }

  async process(job: Job<string>) {
    if (job.name === 'process-intent') {
      const processFn = async (j: Job<string>) => {
        const jobData = BigintSerializer.deserialize<FulfillmentJobData>(j.data);
        this.logger.log(
          `Processing intent ${jobData.intent.intentHash} with strategy ${jobData.strategy} (attempt ${j.attemptsMade + 1}/${j.opts.attempts})`,
        );

        try {
          await this.fulfillmentService.processIntent(jobData.intent, jobData.strategy);
        } catch (error) {
          // Handle ValidationError and AggregatedValidationError
          if (error instanceof ValidationError) {
            // Update intent with error information
            await this.intentsService.updateStatus(
              jobData.intent.intentHash,
              jobData.intent.status!,
              {
                retryCount: j.attemptsMade + 1,
                lastError: {
                  message: error.message,
                  type: error.type,
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
              `Validation error for intent ${jobData.intent.intentHash}: ${error.message} ${errorDetails} (type: ${error.type}, attempt: ${j.attemptsMade + 1})`,
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
      };

      if (this.queueTracing) {
        return this.queueTracing.wrapProcessor(
          'FulfillmentProcessor',
          QueueNames.INTENT_FULFILLMENT,
          processFn,
        )(job);
      } else {
        return processFn(job);
      }
    }
  }
}
