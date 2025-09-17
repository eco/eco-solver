import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { FulfillmentConfigService } from '@/modules/config/services';
import { DataDogService } from '@/modules/datadog';
import { FulfillmentStrategy } from '@/modules/fulfillment/strategies';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';
import { IntentsService } from '@/modules/intents/intents.service';
import { IntentConverter } from '@/modules/intents/utils/intent-converter';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { IntentProcessingService } from './services/intent-processing.service';
import { IntentSubmissionService } from './services/intent-submission.service';
import { StrategyManagementService } from './services/strategy-management.service';

/**
 * FulfillmentService - Facade for fulfillment operations
 * Delegates to specialized services following Single Responsibility Principle
 * Maintains backward compatibility with existing interface
 */
@Injectable()
export class FulfillmentService {
  constructor(
    private readonly intentsService: IntentsService,
    private readonly dataDogService: DataDogService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    private readonly fulfillmentConfigService: FulfillmentConfigService,
    // New specialized services
    private readonly submissionService: IntentSubmissionService,
    private readonly processingService: IntentProcessingService,
    private readonly strategyManagement: StrategyManagementService,
  ) {
    this.logger.setContext(FulfillmentService.name);
  }

  /**
   * Submit an intent for fulfillment
   * Maintains backward compatibility while delegating to IntentSubmissionService
   */
  async submitIntent(
    intent: Intent,
    strategy: FulfillmentStrategyName = this.fulfillmentConfigService.defaultStrategy,
  ): Promise<Intent> {
    const span = this.otelService.startSpan('intent.submit', {
      attributes: {
        'intent.hash': intent.intentHash,
        'intent.source_chain': intent.sourceChainId?.toString() || 'unknown',
        'intent.destination_chain': intent.destination.toString(),
        'intent.strategy': strategy,
        'intent.reward.native_value': intent.reward.nativeAmount.toString(),
        'intent.route.tokens_count': intent.route.tokens.length,
        'intent.route.calls_count': intent.route.calls.length,
      },
    });

    try {
      // Check if a strategy exists and is enabled
      if (!this.strategyManagement.isStrategyEnabled(strategy)) {
        throw new Error(`Strategy '${strategy}' is not available or disabled`);
      }

      // Atomically create intent if it doesn't exist or update lastSeen
      // This handles deduplication at the database level
      const { intent: savedIntent, isNew } = await this.intentsService.createIfNotExists(intent);
      const interfaceIntent = IntentConverter.toInterface(savedIntent);

      if (!isNew) {
        this.logger.log(`Intent ${intent.intentHash} already exists`);
        span.setAttribute('intent.already_exists', true);
        // For existing intents, we still proceed to queue them (they may have failed previously)
      }

      // Use the submission service for queueing only (persistence already handled above)
      await this.submissionService.submitIntent(interfaceIntent, strategy);

      // Record metrics
      this.dataDogService.recordIntent(
        'submitted',
        intent.sourceChainId?.toString() || 'unknown',
        intent.destination.toString(),
        strategy,
      );

      span.setAttribute('intent.queued', true);
      span.setStatus({ code: 0 });

      return interfaceIntent;
    } catch (error) {
      this.logger.error(`Error submitting intent ${intent.intentHash}:`, toError(error));
      span.recordException(toError(error));
      span.setStatus({ code: 2, message: getErrorMessage(error) });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Process an intent through validation and execution
   * Delegates to IntentProcessingService
   */
  async processIntent(intent: Intent, strategyName: FulfillmentStrategyName): Promise<void> {
    const startTime = Date.now();

    try {
      // Delegate to the specialized processing service
      await this.processingService.processIntent(intent, strategyName);

      // Record successful processing metric
      this.dataDogService.recordIntent(
        'fulfilled',
        intent.sourceChainId?.toString() || 'unknown',
        intent.destination.toString(),
        strategyName,
        Date.now() - startTime,
      );
    } catch (error) {
      // Record failure metric
      this.dataDogService.recordIntent(
        'failed',
        intent.sourceChainId?.toString() || 'unknown',
        intent.destination.toString(),
        strategyName,
        Date.now() - startTime,
      );

      // Re-throw to maintain existing error handling behavior
      throw error;
    }
  }

  // Removed @OnEvent handler - listeners now submit directly to fulfillment service

  /**
   * Get a strategy by name
   * Delegates to StrategyManagementService
   */
  getStrategy(strategyName: FulfillmentStrategyName): FulfillmentStrategy | undefined {
    return this.strategyManagement.getStrategy(strategyName) as FulfillmentStrategy | undefined;
  }

  /**
   * Get all available strategies
   * Delegates to StrategyManagementService
   */
  getAllStrategies(): Map<FulfillmentStrategyName, FulfillmentStrategy> {
    const strategies = this.strategyManagement.getAllStrategies();
    const typedStrategies = new Map<FulfillmentStrategyName, FulfillmentStrategy>();

    strategies.forEach((strategy, name) => {
      typedStrategies.set(name as FulfillmentStrategyName, strategy as FulfillmentStrategy);
    });

    return typedStrategies;
  }
}
