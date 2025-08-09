import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { DataDogService } from '@/modules/datadog';
import {
  CrowdLiquidityFulfillmentStrategy,
  FulfillmentStrategy,
  NativeIntentsFulfillmentStrategy,
  NegativeIntentsFulfillmentStrategy,
  RhinestoneFulfillmentStrategy,
  StandardFulfillmentStrategy,
} from '@/modules/fulfillment/strategies';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';
import { IntentsService } from '@/modules/intents/intents.service';
import { IntentConverter } from '@/modules/intents/utils/intent-converter';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueService } from '@/modules/queue/interfaces/queue-service.interface';

@Injectable()
export class FulfillmentService {
  private strategies: Map<FulfillmentStrategyName, FulfillmentStrategy> = new Map();

  constructor(
    private intentsService: IntentsService,
    @Inject(QUEUE_SERVICE) private queueService: QueueService,
    // Inject all strategies
    private standardStrategy: StandardFulfillmentStrategy,
    private crowdLiquidityStrategy: CrowdLiquidityFulfillmentStrategy,
    private nativeIntentsStrategy: NativeIntentsFulfillmentStrategy,
    private negativeIntentsStrategy: NegativeIntentsFulfillmentStrategy,
    private rhinestoneStrategy: RhinestoneFulfillmentStrategy,
    private dataDogService: DataDogService,
    private readonly logger: SystemLoggerService,
  ) {
    this.logger.setContext(FulfillmentService.name);
    // Register strategies by name
    this.strategies.set(this.standardStrategy.name, this.standardStrategy);
    this.strategies.set(this.crowdLiquidityStrategy.name, this.crowdLiquidityStrategy);
    this.strategies.set(this.nativeIntentsStrategy.name, this.nativeIntentsStrategy);
    this.strategies.set(this.negativeIntentsStrategy.name, this.negativeIntentsStrategy);
    this.strategies.set(this.rhinestoneStrategy.name, this.rhinestoneStrategy);
  }

  async submitIntent(intent: Intent, strategy: FulfillmentStrategyName): Promise<Intent> {
    try {
      // Check if intent already exists
      const existingIntent = await this.intentsService.findById(intent.intentHash);
      if (existingIntent) {
        this.logger.log(`Intent ${intent.intentHash} already exists`);
        return IntentConverter.toInterface(existingIntent);
      }

      // Save the intent
      const savedIntent = await this.intentsService.create(intent);
      const interfaceIntent = IntentConverter.toInterface(savedIntent);

      // Add to the fulfillment queue
      await this.queueService.addIntentToFulfillmentQueue(interfaceIntent, strategy);

      this.logger.log(
        `New intent ${intent.intentHash} added to fulfillment queue with strategy: ${strategy}`,
      );

      // Record metrics
      this.dataDogService.recordIntent(
        'submitted',
        intent.route.source.toString(),
        intent.route.destination.toString(),
        strategy,
      );

      return interfaceIntent;
    } catch (error) {
      this.logger.error(`Error submitting intent ${intent.intentHash}:`, error);
      throw error;
    }
  }

  async processIntent(intent: Intent, strategyName: FulfillmentStrategyName): Promise<void> {
    const startTime = Date.now();

    try {
      await this.intentsService.updateStatus(intent.intentHash, IntentStatus.VALIDATING);

      // Get the strategy by name
      const strategy = this.strategies.get(strategyName);
      if (!strategy) {
        await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FAILED);
        this.logger.error(`Unknown fulfillment strategy: ${strategyName}`);
        this.dataDogService.recordIntent(
          'failed',
          intent.route.source.toString(),
          intent.route.destination.toString(),
          strategyName,
          Date.now() - startTime,
        );
        return;
      }

      // Verify the strategy can handle this intent
      if (!strategy.canHandle(intent)) {
        await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FAILED);
        this.logger.error(`Strategy ${strategyName} cannot handle this intent`);
        this.dataDogService.recordIntent(
          'failed',
          intent.route.source.toString(),
          intent.route.destination.toString(),
          strategyName,
          Date.now() - startTime,
        );
        return;
      }

      // Run strategy validation (which includes all configured validations)
      try {
        await strategy.validate(intent);
        this.dataDogService.recordIntent(
          'validated',
          intent.route.source.toString(),
          intent.route.destination.toString(),
          strategyName,
        );
      } catch (validationError) {
        await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FAILED);
        this.logger.error(
          `Validation failed for intent ${intent.intentHash}:`,
          validationError.message,
        );
        this.dataDogService.recordIntent(
          'failed',
          intent.route.source.toString(),
          intent.route.destination.toString(),
          strategyName,
          Date.now() - startTime,
        );
        return;
      }

      // Execute the strategy
      await strategy.execute(intent);

      await this.intentsService.updateStatus(intent.intentHash, IntentStatus.EXECUTING);

      // Record successful fulfillment metric
      this.dataDogService.recordIntent(
        'fulfilled',
        intent.route.source.toString(),
        intent.route.destination.toString(),
        strategyName,
        Date.now() - startTime,
      );
    } catch (error) {
      this.logger.error(`Error processing intent ${intent.intentHash}:`, error);
      await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FAILED);
      this.dataDogService.recordIntent(
        'failed',
        intent.route.source.toString(),
        intent.route.destination.toString(),
        strategyName,
        Date.now() - startTime,
      );
    }
  }

  @OnEvent('intent.discovered')
  async handleIntentDiscovered(payload: { intent: Intent; strategy: FulfillmentStrategyName }) {
    const { intent, strategy } = payload;
    await this.submitIntent(intent, strategy);
  }

  /**
   * Get a strategy by name
   * @param strategyName The name of the strategy to retrieve
   * @returns The strategy instance or undefined if not found
   */
  getStrategy(strategyName: FulfillmentStrategyName): FulfillmentStrategy | undefined {
    return this.strategies.get(strategyName);
  }

  /**
   * Get all available strategies
   * @returns Map of all registered strategies
   */
  getAllStrategies(): Map<FulfillmentStrategyName, FulfillmentStrategy> {
    return new Map(this.strategies);
  }
}
