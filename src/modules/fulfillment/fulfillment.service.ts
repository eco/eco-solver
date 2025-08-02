import { Injectable } from '@nestjs/common';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { IntentsService } from '@/modules/intents/intents.service';
import { FulfillmentStrategy } from '@/modules/fulfillment/strategies';
import { StandardFulfillmentStrategy } from '@/modules/fulfillment/strategies';
import { CrowdLiquidityFulfillmentStrategy } from '@/modules/fulfillment/strategies';
import { NativeIntentsFulfillmentStrategy } from '@/modules/fulfillment/strategies';
import { NegativeIntentsFulfillmentStrategy } from '@/modules/fulfillment/strategies';
import { RhinestoneFulfillmentStrategy } from '@/modules/fulfillment/strategies';

@Injectable()
export class FulfillmentService {
  private strategies: Map<string, FulfillmentStrategy> = new Map();

  constructor(
    private intentsService: IntentsService,
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

  async processIntent(intent: Intent, strategyName: string): Promise<void> {
    try {
      await this.intentsService.updateStatus(intent.intentId, IntentStatus.VALIDATING);

      // Get the strategy by name
      const strategy = this.strategies.get(strategyName);
      if (!strategy) {
        await this.intentsService.updateStatus(intent.intentId, IntentStatus.FAILED, {
          metadata: { reason: `Unknown fulfillment strategy: ${strategyName}` },
        });
        return;
      }

      // Verify the strategy can handle this intent
      if (!strategy.canHandle(intent)) {
        await this.intentsService.updateStatus(intent.intentId, IntentStatus.FAILED, {
          metadata: { reason: `Strategy ${strategyName} cannot handle this intent` },
        });
        return;
      }

      // Run strategy validation (which includes all configured validations)
      try {
        await strategy.validate(intent);
      } catch (validationError) {
        await this.intentsService.updateStatus(intent.intentId, IntentStatus.FAILED, {
          metadata: { reason: validationError.message },
        });
        return;
      }

      // Execute the strategy
      await strategy.execute(intent);

      await this.intentsService.updateStatus(intent.intentId, IntentStatus.EXECUTING);
    } catch (error) {
      console.error(`Error processing intent ${intent.intentId}:`, error);
      await this.intentsService.updateStatus(intent.intentId, IntentStatus.FAILED, {
        metadata: { error: error.message },
      });
    }
  }
}
