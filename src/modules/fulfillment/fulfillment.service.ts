import { Inject, Injectable } from '@nestjs/common';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
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
  ) {
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
        console.log(`Intent ${intent.intentHash} already exists`);
        return IntentConverter.toInterface(existingIntent);
      }

      // Save the intent
      const savedIntent = await this.intentsService.create(intent);
      const interfaceIntent = IntentConverter.toInterface(savedIntent);

      // Add to fulfillment queue
      await this.queueService.addIntentToFulfillmentQueue(interfaceIntent, strategy);

      console.log(
        `New intent ${intent.intentHash} added to fulfillment queue with strategy: ${strategy}`,
      );

      return interfaceIntent;
    } catch (error) {
      console.error(`Error submitting intent ${intent.intentHash}:`, error);
      throw error;
    }
  }

  async processIntent(intent: Intent, strategyName: FulfillmentStrategyName): Promise<void> {
    try {
      await this.intentsService.updateStatus(intent.intentHash, IntentStatus.VALIDATING);

      // Get the strategy by name
      const strategy = this.strategies.get(strategyName);
      if (!strategy) {
        await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FAILED);
        console.error(`Unknown fulfillment strategy: ${strategyName}`);
        return;
      }

      // Verify the strategy can handle this intent
      if (!strategy.canHandle(intent)) {
        await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FAILED);
        console.error(`Strategy ${strategyName} cannot handle this intent`);
        return;
      }

      // Run strategy validation (which includes all configured validations)
      try {
        await strategy.validate(intent);
      } catch (validationError) {
        await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FAILED);
        console.error(
          `Validation failed for intent ${intent.intentHash}:`,
          validationError.message,
        );
        return;
      }

      // Execute the strategy
      await strategy.execute(intent);

      await this.intentsService.updateStatus(intent.intentHash, IntentStatus.EXECUTING);
    } catch (error) {
      console.error(`Error processing intent ${intent.intentHash}:`, error);
      await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FAILED);
    }
  }
}
