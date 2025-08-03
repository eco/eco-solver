import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { ChainConfig } from '@/common/interfaces/chain-config.interface';
import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';

@Injectable()
export abstract class BaseChainListener implements OnModuleInit, OnModuleDestroy {
  protected config: ChainConfig;

  constructor(
    config: ChainConfig,
    protected fulfillmentService: FulfillmentService,
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
      await this.fulfillmentService.submitIntent(intent);
    } catch (error) {
      console.error(`Error handling intent ${intent.intentId}:`, error);
    }
  }
}
