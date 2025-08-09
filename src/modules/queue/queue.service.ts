import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { Queue } from 'bullmq';

import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentJobData } from '@/modules/fulfillment/interfaces/fulfillment-job.interface';
import {
  FULFILLMENT_STRATEGY_NAMES,
  FulfillmentStrategyName,
} from '@/modules/fulfillment/types/strategy-name.type';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';
import { ExecutionJobData } from '@/modules/queue/interfaces/execution-job.interface';
import { QueueService as IQueueService } from '@/modules/queue/interfaces/queue-service.interface';
import { QueueSerializer } from '@/modules/queue/utils/queue-serializer';

@Injectable()
export class QueueService implements IQueueService, OnModuleDestroy {
  constructor(
    @InjectQueue('intent-fulfillment') private fulfillmentQueue: Queue,
    @InjectQueue('blockchain-execution') private executionQueue: Queue,
    private readonly logger: SystemLoggerService,
  ) {
    this.logger.setContext(QueueService.name);
  }

  async addIntentToFulfillmentQueue(
    intent: Intent,
    strategy: FulfillmentStrategyName = FULFILLMENT_STRATEGY_NAMES.STANDARD,
  ): Promise<void> {
    const jobData: FulfillmentJobData = {
      intent,
      strategy,
    };

    const serializedData = QueueSerializer.serialize(jobData);

    await this.fulfillmentQueue.add('process-intent', serializedData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }

  async addIntentToExecutionQueue(jobData: ExecutionJobData): Promise<void> {
    const serializedData = QueueSerializer.serialize(jobData);

    await this.executionQueue.add(
      `${QueueNames.INTENT_EXECUTION}-chain-${jobData.chainId}`,
      serializedData,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
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

  async addJob(queueName: string, data: any, options?: any): Promise<void> {
    const queue = queueName === 'intent-fulfillment' ? this.fulfillmentQueue : this.executionQueue;
    const serializedData = QueueSerializer.serialize(data);
    await queue.add(queueName, serializedData, options);
  }

  async onModuleDestroy() {
    this.logger.log('Gracefully shutting down queues...');

    try {
      // Pause queues to prevent new jobs from being processed
      await Promise.all([this.fulfillmentQueue.pause(), this.executionQueue.pause()]);

      // Wait for active jobs to complete (with timeout)
      const timeout = 15000; // 15 seconds
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        const [fulfillmentActive, executionActive] = await Promise.all([
          this.fulfillmentQueue.getActiveCount(),
          this.executionQueue.getActiveCount(),
        ]);

        if (fulfillmentActive === 0 && executionActive === 0) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Close queue connections
      await Promise.all([this.fulfillmentQueue.close(), this.executionQueue.close()]);

      this.logger.log('Queues shutdown completed');
    } catch (error) {
      this.logger.error('Error during queue shutdown:', error);
    }
  }
}
