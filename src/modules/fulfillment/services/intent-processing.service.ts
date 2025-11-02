import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { ValidationError } from '@/modules/fulfillment/errors/validation.error';
import { IntentsService } from '@/modules/intents/intents.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { StrategyManagementService } from './strategy-management.service';

/**
 * Service responsible for processing intents through strategies
 * Single Responsibility: Intent processing and validation orchestration
 */
@Injectable()
export class IntentProcessingService {
  constructor(
    @InjectPinoLogger(IntentProcessingService.name)
    private readonly logger: PinoLogger,
    private readonly strategyManagement: StrategyManagementService,
    private readonly intentsService: IntentsService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  /**
   * Process an intent using the specified strategy
   * This includes validation and direct execution (not queueing)
   */
  async processIntent(intent: Intent, strategyName: string): Promise<void> {
    return this.otelService.tracer.startActiveSpan(
      'intent.processing.process',
      {
        attributes: {
          'intent.hash': intent.intentHash,
          'intent.source_chain': intent.sourceChainId.toString(),
          'intent.destination_chain': intent.destination.toString(),
          'processing.strategy': strategyName,
        },
      },
      async (span) => {
        try {
          // Get the strategy
          const strategy = this.strategyManagement.getStrategy(strategyName);
          if (!strategy) {
            await this.updateIntentStatus(intent, IntentStatus.FAILED);
            this.logger.error(`Unknown fulfillment strategy: ${strategyName}`);
            span.addEvent('intent.strategy.not_found', {
              strategy: strategyName,
            });
            span.setStatus({
              code: api.SpanStatusCode.ERROR,
              message: `Unknown strategy: ${strategyName}`,
            });
            return;
          }

          // Verify the strategy can handle this intent
          if (!strategy.canHandle(intent)) {
            await this.updateIntentStatus(intent, IntentStatus.FAILED);
            this.logger.error(`Strategy ${strategyName} cannot handle this intent`);
            span.addEvent('intent.strategy.cannot_handle', {
              strategy: strategyName,
            });
            span.setStatus({
              code: api.SpanStatusCode.ERROR,
              message: `Strategy cannot handle intent`,
            });
            return;
          }

          // Update intent status to validating
          await this.updateIntentStatus(intent, IntentStatus.VALIDATING);
          span.addEvent('intent.status.updated', {
            status: IntentStatus.VALIDATING,
          });

          // Run strategy validation
          try {
            span.addEvent('intent.validation.started');
            await strategy.validate(intent);
            span.addEvent('intent.validation.completed');
          } catch (validationError) {
            // Handle ValidationError specifically
            if (validationError instanceof ValidationError) {
              // For permanent errors, mark as FAILED
              if (validationError.type === 'permanent') {
                await this.updateIntentStatus(intent, IntentStatus.FAILED);
              }
              this.logger.error(
                `Validation failed for intent ${intent.intentHash}: ${validationError.message} (type: ${validationError.type})`,
              );
            } else {
              // For non-ValidationError, mark as failed
              await this.updateIntentStatus(intent, IntentStatus.FAILED);
              this.logger.error(
                `Validation failed for intent ${intent.intentHash}:`,
                (validationError as Error).message,
              );
            }

            span.addEvent('intent.validation.failed', {
              error: (validationError as Error).message,
              errorType:
                validationError instanceof ValidationError ? validationError.type : 'unknown',
            });
            span.recordException(validationError as Error);
            span.setStatus({ code: api.SpanStatusCode.ERROR, message: 'Validation failed' });

            // Re-throw to let the processor handle retry logic
            throw validationError;
          }

          // Execute the strategy directly
          span.addEvent('intent.execution.started');
          await strategy.execute(intent);
          span.addEvent('intent.execution.completed');

          // Update status to executing
          await this.updateIntentStatus(intent, IntentStatus.EXECUTING);
          span.addEvent('intent.status.updated', {
            status: IntentStatus.EXECUTING,
          });

          span.setAttribute('processing.success', true);
          span.setStatus({ code: api.SpanStatusCode.OK });

          this.logger.info(`Intent processed successfully: ${intent.intentHash}`, {
            intentHash: intent.intentHash,
            strategy: strategyName,
          });
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });

          await this.handleProcessingError(intent, toError(error));
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Handle processing error
   */
  private async handleProcessingError(intent: Intent, error: Error): Promise<void> {
    return this.otelService.tracer.startActiveSpan(
      'intent.processing.handleError',
      {
        attributes: {
          'intent.hash': intent.intentHash,
          'error.message': getErrorMessage(error),
        },
      },
      async (span) => {
        try {
          await this.updateIntentStatus(intent, IntentStatus.FAILED);

          this.logger.error(`Intent processing failed: ${intent.intentHash}`, error, {
            intentHash: intent.intentHash,
          });

          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (updateError) {
          span.recordException(updateError as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });

          this.logger.error(
            `Failed to update intent status after error: ${intent.intentHash}`,
            toError(updateError),
            { intentHash: intent.intentHash },
          );
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Update intent status
   */
  private async updateIntentStatus(intent: Intent, status: IntentStatus): Promise<void> {
    const span = this.otelService.startSpan('intent.processing.updateStatus', {
      attributes: {
        'intent.hash': intent.intentHash,
        'status.new': status,
        'status.old': intent.status,
      },
    });

    try {
      intent.status = status;
      await this.intentsService.updateStatus(intent.intentHash, status);

      span.setStatus({ code: api.SpanStatusCode.OK });
    } catch (error) {
      span.recordException(toError(error));
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }
}
