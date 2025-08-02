import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { IntentsService } from '@/modules/intents/intents.service';
import { EvmListener } from '@/modules/on-chain-listener/listeners/evm.listener';
import { SolanaListener } from '@/modules/on-chain-listener/listeners/solana.listener';
import { QueueService } from '@/modules/queue/queue.service';

@Injectable()
export class OnChainListenerService implements OnModuleInit, OnModuleDestroy {
  private listeners: BaseChainListener[] = [];

  constructor(
    private queueService: QueueService,
    private intentsService: IntentsService,
    private evmListener: EvmListener,
    private solanaListener: SolanaListener,
  ) {}

  async onModuleInit() {
    await this.initializeListeners();
    await this.startListeners();
  }

  async onModuleDestroy() {
    await this.stopListeners();
  }

  private async initializeListeners() {
    this.listeners = [this.evmListener, this.solanaListener];

    for (const listener of this.listeners) {
      listener.onIntent(async (intent: Intent) => {
        await this.handleNewIntent(intent);
      });
    }
  }

  private async startListeners() {
    await Promise.all(this.listeners.map((listener) => listener.start()));
  }

  private async stopListeners() {
    await Promise.all(this.listeners.map((listener) => listener.stop()));
  }

  private async handleNewIntent(intent: Intent) {
    try {
      const existingIntent = await this.intentsService.findById(intent.intentId);
      if (existingIntent) {
        console.log(`Intent ${intent.intentId} already exists`);
        return;
      }

      const savedIntent = await this.intentsService.create(intent);
      const strategy = this.determineStrategy(savedIntent);
      await this.queueService.addIntentToFulfillmentQueue(savedIntent, strategy);

      console.log(`New intent ${intent.intentId} added to fulfillment queue with strategy: ${strategy}`);
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
