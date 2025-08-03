import { Inject, Injectable } from '@nestjs/common';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { FulfillmentConfigService } from '@/modules/config/services';
import { FulfillmentStrategy } from '@/modules/fulfillment/strategies';
import { StandardFulfillmentStrategy } from '@/modules/fulfillment/strategies';
import { CrowdLiquidityFulfillmentStrategy } from '@/modules/fulfillment/strategies';
import { NativeIntentsFulfillmentStrategy } from '@/modules/fulfillment/strategies';
import { NegativeIntentsFulfillmentStrategy } from '@/modules/fulfillment/strategies';
import { RhinestoneFulfillmentStrategy } from '@/modules/fulfillment/strategies';
import { IntentsService } from '@/modules/intents/intents.service';
import { IntentConverter } from '@/modules/intents/utils/intent-converter';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueService } from '@/modules/queue/interfaces/queue-service.interface';

@Injectable()
export class FulfillmentService {
  private strategies: Map<string, FulfillmentStrategy> = new Map();

  constructor(
    private intentsService: IntentsService,
    private fulfillmentConfigService: FulfillmentConfigService,
    @Inject(QUEUE_SERVICE) private queueService: QueueService,
    // Inject all strategies
    private standardStrategy: StandardFulfillmentStrategy,
    private crowdLiquidityStrategy: CrowdLiquidityFulfillmentStrategy,
    private nativeIntentsStrategy: NativeIntentsFulfillmentStrategy,
    private negativeIntentsStrategy: NegativeIntentsFulfillmentStrategy,
    private rhinestoneStrategy: RhinestoneFulfillmentStrategy,
  ) {
    // Register strategies by name
    this.strategies.set(this.standardStrategy.name, this.standardStrategy);
    this.strategies.set(this.crowdLiquidityStrategy.name, this.crowdLiquidityStrategy);
    this.strategies.set(this.nativeIntentsStrategy.name, this.nativeIntentsStrategy);
    this.strategies.set(this.negativeIntentsStrategy.name, this.negativeIntentsStrategy);
    this.strategies.set(this.rhinestoneStrategy.name, this.rhinestoneStrategy);
  }

  async submitIntent(intent: Intent): Promise<Intent> {
    try {
      // Check if intent already exists
      const existingIntent = await this.intentsService.findById(intent.intentId);
      if (existingIntent) {
        console.log(`Intent ${intent.intentId} already exists`);
        return IntentConverter.toInterface(existingIntent);
      }

      // Save the intent
      const savedIntent = await this.intentsService.create(intent);
      const interfaceIntent = IntentConverter.toInterface(savedIntent);
      
      // Determine the strategy
      const strategy = this.determineStrategy(interfaceIntent);
      
      // Add to fulfillment queue
      await this.queueService.addIntentToFulfillmentQueue(interfaceIntent, strategy);
      
      console.log(
        `New intent ${intent.intentId} added to fulfillment queue with strategy: ${strategy}`,
      );
      
      return interfaceIntent;
    } catch (error) {
      console.error(`Error submitting intent ${intent.intentId}:`, error);
      throw error;
    }
  }

  private determineStrategy(intent: Intent): string {
    // For now, use the default strategy from configuration
    // In the future, we could analyze intent properties to determine strategy
    // For example:
    // - Check if intent involves only native tokens -> 'native-intents'
    // - Check if intent requires smart account features -> 'rhinestone'
    // - Check if intent has specific route patterns -> 'crowd-liquidity'
    
    return this.fulfillmentConfigService.defaultStrategy;
  }

  async processIntent(intent: Intent, strategyName: string): Promise<void> {
    try {
      await this.intentsService.updateStatus(intent.intentId, IntentStatus.VALIDATING);

      // Get the strategy by name
      const strategy = this.strategies.get(strategyName);
      if (!strategy) {
        await this.intentsService.updateStatus(intent.intentId, IntentStatus.FAILED);
        console.error(`Unknown fulfillment strategy: ${strategyName}`);
        return;
      }

      // Verify the strategy can handle this intent
      if (!strategy.canHandle(intent)) {
        await this.intentsService.updateStatus(intent.intentId, IntentStatus.FAILED);
        console.error(`Strategy ${strategyName} cannot handle this intent`);
        return;
      }

      // Run strategy validation (which includes all configured validations)
      try {
        await strategy.validate(intent);
      } catch (validationError) {
        await this.intentsService.updateStatus(intent.intentId, IntentStatus.FAILED);
        console.error(`Validation failed for intent ${intent.intentId}:`, validationError.message);
        return;
      }

      // Execute the strategy
      await strategy.execute(intent);

      await this.intentsService.updateStatus(intent.intentId, IntentStatus.EXECUTING);
    } catch (error) {
      console.error(`Error processing intent ${intent.intentId}:`, error);
      await this.intentsService.updateStatus(intent.intentId, IntentStatus.FAILED);
    }
  }
}
