import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

@Injectable()
export abstract class BaseChainListener implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.start();
  }

  async onModuleDestroy() {
    await this.stop();
  }

  abstract start(): Promise<void>;

  abstract stop(): Promise<void>;
}
