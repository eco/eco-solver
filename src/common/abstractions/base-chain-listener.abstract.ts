import { Injectable } from '@nestjs/common';

import { ChainConfig } from '@/common/interfaces/chain-config.interface';
import { Intent } from '@/common/interfaces/intent.interface';

@Injectable()
export abstract class BaseChainListener {
  protected config: ChainConfig;

  constructor(config: ChainConfig) {
    this.config = config;
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract onIntent(callback: (intent: Intent) => Promise<void>): void;

  protected abstract parseIntentFromEvent(event: any): Intent;
}
