import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { ChainConfig } from '@/common/interfaces/chain-config.interface';
import { Intent } from '@/common/interfaces/intent.interface';
import { IntentsService } from '@/modules/intents/intents.service';
import { IntentConverter } from '@/modules/intents/utils/intent-converter';
import { QueueService } from '@/modules/queue/queue.service';

@Injectable()
export abstract class BaseChainListener implements OnModuleInit, OnModuleDestroy {
  protected config: ChainConfig;

  constructor(
    config: ChainConfig,
    protected intentsService: IntentsService,
    protected queueService: QueueService,
  ) {
    this.config = config;
  }

  async onModuleInit() {
    this.onIntent(async (intent: Intent) => {
      await this.handleNewIntent(intent);
    });
    await this.start();
  }

  async onModuleDestroy() {
    await this.stop();
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract onIntent(callback: (intent: Intent) => Promise<void>): void;

  protected abstract parseIntentFromEvent(event: any): Intent;

  private async handleNewIntent(intent: Intent) {
    try {
      const existingIntent = await this.intentsService.findById(intent.intentId);
      if (existingIntent) {
        console.log(`Intent ${intent.intentId} already exists`);
        return;
      }

      const savedIntent = await this.intentsService.create(intent);
      const interfaceIntent = IntentConverter.toInterface(savedIntent);
      const strategy = this.determineStrategy(interfaceIntent);
      await this.queueService.addIntentToFulfillmentQueue(interfaceIntent, strategy);

      console.log(
        `New intent ${intent.intentId} added to fulfillment queue with strategy: ${strategy}`,
      );
    } catch (error) {
      console.error(`Error handling intent ${intent.intentId}:`, error);
    }
  }

  private determineStrategy(intent: Intent): string {
    // Check intent metadata for explicit strategy
    if (intent.metadata?.strategyType) {
      return intent.metadata.strategyType;
    }

    // Check for specific conditions that determine the strategy
    if (intent.metadata?.useSmartAccount === true) {
      return 'rhinestone';
    }

    if (intent.metadata?.isNegativeIntent === true) {
      return 'negative-intents';
    }

    if (intent.metadata?.isNativeToken === true) {
      return 'native-intents';
    }

    if (intent.metadata?.useCrowdLiquidity === true) {
      return 'crowd-liquidity';
    }

    // Default to standard strategy
    return 'standard';
  }
}
