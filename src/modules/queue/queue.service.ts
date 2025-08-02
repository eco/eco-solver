import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';

import { Queue } from 'bullmq';

import { Intent } from '@/common/interfaces/intent.interface';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('intent-fulfillment') private fulfillmentQueue: Queue,
    @InjectQueue('wallet-execution') private executionQueue: Queue,
  ) {}

  async addIntentToFulfillmentQueue(intent: Intent): Promise<void> {
    await this.fulfillmentQueue.add('process-intent', intent, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }

  async addIntentToExecutionQueue(intent: Intent, walletAddress: string): Promise<void> {
    const queueName = `wallet-${walletAddress}-${intent.targetChainId}`;

    await this.executionQueue.add(
      queueName,
      { intent, walletAddress },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );
  }

  async getQueueStatus(queueName: string): Promise<any> {
    const queue = queueName === 'fulfillment' ? this.fulfillmentQueue : this.executionQueue;

    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }
}
