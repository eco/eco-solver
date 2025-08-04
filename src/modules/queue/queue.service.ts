import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';

import { Queue } from 'bullmq';

import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentJobData } from '@/modules/fulfillment/interfaces/fulfillment-job.interface';
import {
  FULFILLMENT_STRATEGY_NAMES,
  FulfillmentStrategyName,
} from '@/modules/fulfillment/types/strategy-name.type';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';
import { ExecutionJobData } from '@/modules/queue/interfaces/execution-job.interface';
import { QueueService as IQueueService } from '@/modules/queue/interfaces/queue-service.interface';

@Injectable()
export class QueueService implements IQueueService {
  constructor(
    @InjectQueue('intent-fulfillment') private fulfillmentQueue: Queue,
    @InjectQueue('blockchain-execution') private executionQueue: Queue,
  ) {}

  async addIntentToFulfillmentQueue(
    intent: Intent,
    strategy: FulfillmentStrategyName = FULFILLMENT_STRATEGY_NAMES.STANDARD,
  ): Promise<void> {
    const jobData: FulfillmentJobData = {
      intent,
      strategy,
    };

    await this.fulfillmentQueue.add('process-intent', jobData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }

  async addIntentToExecutionQueue(
    intent: Intent,
    strategy: FulfillmentStrategyName,
  ): Promise<void> {
    const jobData: ExecutionJobData = {
      strategy,
      intent,
    };

    await this.executionQueue.add(QueueNames.INTENT_EXECUTION, jobData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
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

  async addJob(queueName: string, data: any, options?: any): Promise<void> {
    const queue = queueName === 'intent-fulfillment' ? this.fulfillmentQueue : this.executionQueue;
    await queue.add(queueName, data, options);
  }
}
