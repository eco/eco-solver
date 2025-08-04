import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { z } from 'zod';

import { QueueSchema } from '@/config/config.schema';

type QueueConfig = z.infer<typeof QueueSchema>;

@Injectable()
export class QueueConfigService {
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

  get concurrency(): QueueConfig['concurrency'] {
    return this.configService.get<number>('queue.concurrency');
  }

  get executionConcurrency(): QueueConfig['executionConcurrency'] {
    return this.configService.get<number>('queue.executionConcurrency');
  }

  get maxRetriesPerRequest(): QueueConfig['maxRetriesPerRequest'] {
    return this.configService.get<number>('queue.maxRetriesPerRequest');
  }

  get retryDelayMs(): QueueConfig['retryDelayMs'] {
    return this.configService.get<number>('queue.retryDelayMs');
  }
}
