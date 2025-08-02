import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { QueueConfig } from '@/modules/config/interfaces';

@Injectable()
export class QueueConfigService implements QueueConfig {
  constructor(private configService: ConfigService) {}

  get defaultJobOptions() {
    return {
      attempts: this.configService.get<number>('queue.attempts'),
      backoff: {
        type: this.configService.get<string>('queue.backoffType'),
        delay: this.configService.get<number>('queue.backoffDelay'),
      },
    };
  }

  get concurrency(): number {
    return this.configService.get<number>('queue.concurrency');
  }

  get maxRetriesPerRequest(): number | undefined {
    return this.configService.get<number>('queue.maxRetriesPerRequest');
  }

  get retryDelayMs(): number | undefined {
    return this.configService.get<number>('queue.retryDelayMs');
  }
}
