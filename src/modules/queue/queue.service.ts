import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';

import { Queue } from 'bullmq';

import { Intent } from '@/common/interfaces/intent.interface';
import { QueueConfigService } from '@/modules/config/services/queue-config.service';
import { FulfillmentJobData } from '@/modules/fulfillment/interfaces/fulfillment-job.interface';
import {
  FULFILLMENT_STRATEGY_NAMES,
  FulfillmentStrategyName,
} from '@/modules/fulfillment/types/strategy-name.type';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { QueueTracingService } from '@/modules/opentelemetry/queue-tracing.service';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';
import { ExecutionJobData } from '@/modules/queue/interfaces/execution-job.interface';
import { QueueService as IQueueService } from '@/modules/queue/interfaces/queue-service.interface';
import { QueueSerializer } from '@/modules/queue/utils/queue-serializer';

@Injectable()
export class QueueService implements IQueueService, OnApplicationBootstrap, OnModuleDestroy {
  constructor(
    @InjectQueue(QueueNames.INTENT_FULFILLMENT) private fulfillmentQueue: Queue,
    @InjectQueue(QueueNames.INTENT_EXECUTION) private executionQueue: Queue,
    private readonly logger: SystemLoggerService,
    private readonly queueConfig: QueueConfigService,
    @Optional() private readonly queueTracing?: QueueTracingService,
  ) {
    this.logger.setContext(QueueService.name);
  }

  async onApplicationBootstrap() {
    this.logger.log('Checking queue states on startup...');

    // Check and resume fulfillment queue if paused
    const fulfillmentPaused = await this.fulfillmentQueue.isPaused();
    if (fulfillmentPaused) {
      await this.fulfillmentQueue.resume();
      this.logger.log('Resumed paused fulfillment queue on startup');
    } else {
      this.logger.log('Fulfillment queue is already running');
    }

    // Check and resume execution queue if paused
    const executionPaused = await this.executionQueue.isPaused();
    if (executionPaused) {
      await this.executionQueue.resume();
      this.logger.log('Resumed paused execution queue on startup');
    } else {
      this.logger.log('Execution queue is already running');
    }
  }

  async addIntentToFulfillmentQueue(
    intent: Intent,
    strategy: FulfillmentStrategyName = FULFILLMENT_STRATEGY_NAMES.STANDARD,
  ): Promise<void> {
    const jobData: FulfillmentJobData = {
      intent,
      strategy,
      chainId: Number(intent.destination),
    };

    const serializedData = QueueSerializer.serialize(jobData);

    const addJob = async () => {
      // Use maximum retry attempts from config to allow for TEMPORARY error retries
      // The processor will control actual retry behavior based on error type
      const { attempts, backoffMs } = this.queueConfig.temporaryRetryConfig;
      await this.fulfillmentQueue.add('process-intent', serializedData, {
        attempts, // Default 5 attempts for TEMPORARY errors
        backoff: {
          type: 'exponential',
          delay: backoffMs || 5000,
        },
      });
    };

    if (this.queueTracing) {
      await this.queueTracing.traceQueueAdd(
        QueueNames.INTENT_FULFILLMENT,
        'process-intent',
        jobData,
        addJob,
      );
    } else {
      await addJob();
    }
  }

  async addIntentToExecutionQueue(jobData: ExecutionJobData): Promise<void> {
    const serializedData = QueueSerializer.serialize(jobData);
    const jobName = `${QueueNames.INTENT_EXECUTION}-chain-${jobData.chainId}`;

    const addJob = async () => {
      await this.executionQueue.add(jobName, serializedData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });
    };

    if (this.queueTracing) {
      await this.queueTracing.traceQueueAdd(QueueNames.INTENT_EXECUTION, jobName, jobData, addJob);
    } else {
      await addJob();
    }
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
    const queue =
      queueName === QueueNames.INTENT_FULFILLMENT ? this.fulfillmentQueue : this.executionQueue;
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
