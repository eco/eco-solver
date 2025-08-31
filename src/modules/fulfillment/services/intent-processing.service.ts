import { Inject, Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { IFulfillmentStrategy } from '@/common/interfaces/strategy-registry.interface';
import { ValidationError } from '@/modules/fulfillment/errors/validation.error';
import { IntentsService } from '@/modules/intents/intents.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueService } from '@/modules/queue/interfaces/queue-service.interface';

import { StrategyManagementService } from './strategy-management.service';

/**
 * Service responsible for processing intents through strategies
 * Single Responsibility: Intent processing and validation orchestration
 */
@Injectable()
export class IntentProcessingService {
  constructor(
    private readonly logger: SystemLoggerService,
    private readonly strategyManagement: StrategyManagementService,
    private readonly intentsService: IntentsService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueService,
    private readonly otelService: OpenTelemetryService,
  ) {
    this.logger.setContext(IntentProcessingService.name);
  }

  /**
   * Process an intent using the specified strategy
   * This includes validation and direct execution (not queueing)
   */
  async processIntent(intent: Intent, strategyName: string): Promise<void> {
    const span = this.otelService.startSpan('intent.processing.process', {
      attributes: {
        'intent.hash': intent.intentHash,
        'intent.source_chain': intent.sourceChainId?.toString() || 'unknown',
        'intent.destination_chain': intent.destination.toString(),
        'processing.strategy': strategyName,
      },
    });

    try {
      // Get the strategy
      const strategy = await this.getStrategy(strategyName);
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
        await api.context.with(api.trace.setSpan(api.context.active(), span), async () => {
          await strategy.validate(intent);
        });
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
          errorType: validationError instanceof ValidationError ? validationError.type : 'unknown',
        });
        span.recordException(validationError as Error);
        span.setStatus({ code: api.SpanStatusCode.ERROR, message: 'Validation failed' });

        // Re-throw to let the processor handle retry logic
        throw validationError;
      }

      // Execute the strategy directly
      span.addEvent('intent.execution.started');
      await api.context.with(api.trace.setSpan(api.context.active(), span), async () => {
        await strategy.execute(intent);
      });
      span.addEvent('intent.execution.completed');

      // Update status to executing
      await this.updateIntentStatus(intent, IntentStatus.EXECUTING);
      span.addEvent('intent.status.updated', {
        status: IntentStatus.EXECUTING,
      });

      span.setAttribute('processing.success', true);
      span.setStatus({ code: api.SpanStatusCode.OK });

      this.logger.log(`Intent processed successfully: ${intent.intentHash}`, {
        intentHash: intent.intentHash,
        strategy: strategyName,
      });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });

      await this.handleProcessingError(intent, error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Get processing metrics
   */
  async getProcessingMetrics(): Promise<{
    totalProcessed: number;
    successfulValidations: number;
    failedValidations: number;
    averageProcessingTime: number;
  }> {
    const span = this.otelService.startSpan('intent.processing.getMetrics');

    try {
      // This would integrate with a metrics service in a complete implementation
      const metrics = {
        totalProcessed: 0,
        successfulValidations: 0,
        failedValidations: 0,
        averageProcessingTime: 0,
      };

      span.setAttributes({
        'metrics.total_processed': metrics.totalProcessed,
        'metrics.successful_validations': metrics.successfulValidations,
        'metrics.failed_validations': metrics.failedValidations,
        'metrics.avg_processing_time': metrics.averageProcessingTime,
      });
      span.setStatus({ code: api.SpanStatusCode.OK });

      return metrics;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Queue intent for execution
   */
  private async queueForExecution(intent: Intent, strategyName: string): Promise<void> {
    const span = this.otelService.startSpan('intent.processing.queueExecution', {
      attributes: {
        'intent.hash': intent.intentHash,
        'execution.strategy': strategyName,
      },
    });

    try {
      // Create execution job data with required fields
      const executionJobData = {
        strategy: strategyName as any, // Will be cast to FulfillmentStrategyName
        intent,
        chainId: intent.destination,
      };
      await this.queueService.addIntentToExecutionQueue(executionJobData);
      await this.updateIntentStatus(intent, IntentStatus.EXECUTING);

      span.setStatus({ code: api.SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Validate an intent using a strategy
   */
  private async validateIntent(intent: Intent, strategy: IFulfillmentStrategy): Promise<boolean> {
    const span = this.otelService.startSpan('intent.processing.validate', {
      attributes: {
        'intent.hash': intent.intentHash,
        'validation.strategy': strategy.name,
      },
    });

    try {
      const isValid = await strategy.validate(intent);

      span.setAttribute('validation.result', isValid);
      span.setStatus({ code: api.SpanStatusCode.OK });

      if (!isValid) {
        this.logger.warn(`Intent validation failed: ${intent.intentHash}`, {
          intentHash: intent.intentHash,
          strategy: strategy.name,
        });
      }

      return isValid;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });

      this.logger.error(`Intent validation error: ${intent.intentHash}`, error, {
        intentHash: intent.intentHash,
        strategy: strategy.name,
      });

      return false;
    } finally {
      span.end();
    }
  }

  /**
   * Get a strategy by name
   */
  private async getStrategy(strategyName: string): Promise<IFulfillmentStrategy | undefined> {
    return this.strategyManagement.getStrategy(strategyName);
  }

  /**
   * Handle validation failure
   */
  private async handleValidationFailure(intent: Intent): Promise<void> {
    const span = this.otelService.startSpan('intent.processing.handleFailure', {
      attributes: {
        'intent.hash': intent.intentHash,
      },
    });

    try {
      await this.updateIntentStatus(intent, IntentStatus.FAILED);

      this.logger.warn(`Intent validation failed: ${intent.intentHash}`, {
        intentHash: intent.intentHash,
      });

      span.setStatus({ code: api.SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Handle processing error
   */
  private async handleProcessingError(intent: Intent, error: Error): Promise<void> {
    const span = this.otelService.startSpan('intent.processing.handleError', {
      attributes: {
        'intent.hash': intent.intentHash,
        'error.message': error.message,
      },
    });

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
        updateError,
        { intentHash: intent.intentHash },
      );
    } finally {
      span.end();
    }
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
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }
}
