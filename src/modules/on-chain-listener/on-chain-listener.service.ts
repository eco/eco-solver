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
      await this.queueService.addIntentToFulfillmentQueue(savedIntent);

      console.log(`New intent ${intent.intentId} added to fulfillment queue`);
    } catch (error) {
      console.error(`Error handling intent ${intent.intentId}:`, error);
    }
  }
}
