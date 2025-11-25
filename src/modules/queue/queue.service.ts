import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';

import { Queue } from 'bullmq';

import { Intent } from '@/common/interfaces/intent.interface';
import { BigintSerializer } from '@/common/utils/bigint-serializer';
import { toError } from '@/common/utils/error-handler';
import { BlockchainEventJob } from '@/modules/blockchain/interfaces/blockchain-event-job.interface';
import { QueueConfigService } from '@/modules/config/services/queue-config.service';
import { FulfillmentJobData } from '@/modules/fulfillment/interfaces/fulfillment-job.interface';
import {
  FULFILLMENT_STRATEGY_NAMES,
  FulfillmentStrategyName,
} from '@/modules/fulfillment/types/strategy-name.type';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';
import { ExecutionJobData } from '@/modules/queue/interfaces/execution-job.interface';
import { IQueueService } from '@/modules/queue/interfaces/queue-service.interface';

@Injectable()
export class QueueService implements IQueueService, OnApplicationBootstrap, OnModuleDestroy {
  private readonly queues: Map<string, Queue>;

  constructor(
    private readonly logger: SystemLoggerService,
    private readonly queueConfig: QueueConfigService,
    @InjectQueue(QueueNames.INTENT_EXECUTION) private executionQueue: Queue,
    @InjectQueue(QueueNames.INTENT_FULFILLMENT) private fulfillmentQueue: Queue,
    @InjectQueue(QueueNames.INTENT_WITHDRAWAL) private withdrawalQueue: Queue,
    @InjectQueue(QueueNames.BLOCKCHAIN_EVENTS) private blockchainEventsQueue: Queue,
  ) {
    this.logger.setContext(QueueService.name);

    // Initialize queue map for easier management
    this.queues = new Map([
      [QueueNames.INTENT_FULFILLMENT, this.fulfillmentQueue],
      [QueueNames.INTENT_EXECUTION, this.executionQueue],
      [QueueNames.INTENT_WITHDRAWAL, this.withdrawalQueue],
      [QueueNames.BLOCKCHAIN_EVENTS, this.blockchainEventsQueue],
    ]);
  }

  async onApplicationBootstrap() {
    this.logger.log('Checking queue states on startup...');

    // Check and resume all queues if paused
    for (const [queueName, queue] of this.queues) {
      const isPaused = await queue.isPaused();
      if (isPaused) {
        await queue.resume();
        this.logger.log(`Resumed paused ${queueName} queue on startup`);
      } else {
        this.logger.log(`${queueName} queue is already running`);
      }
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

    // Use maximum retry attempts from config to allow for TEMPORARY error retries
    // The processor will control actual retry behavior based on error type
    const { attempts, backoffMs } = this.queueConfig.temporaryRetryConfig;
    const serializedData = BigintSerializer.serialize(jobData);
    await this.fulfillmentQueue.add('process-intent', serializedData, {
      attempts,
      backoff: {
        type: 'exponential',
        delay: backoffMs || 5000,
      },
      delay: this.queueConfig.fulfillmentJobDelay,
    });
  }

  async addIntentToExecutionQueue(jobData: ExecutionJobData): Promise<void> {
    const jobName = `${QueueNames.INTENT_EXECUTION}-chain-${jobData.chainId}`;

    const serializedData = BigintSerializer.serialize(jobData);

    // Use configuration instead of hardcoded values
    const jobOptions = this.queueConfig.executionJobOptions;

    await this.executionQueue.add(jobName, serializedData, jobOptions);
  }

  async addBlockchainEvent(job: BlockchainEventJob): Promise<void> {
    // Generate deterministic job ID: contractName-eventType-intentHash
    const jobId = `${job.contractName}-${job.eventType}-${job.intentHash}`;

    const serializedData = BigintSerializer.serialize(job);

    // Add job with deduplication ID
    await this.blockchainEventsQueue.add('process-blockchain-event', serializedData, {
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  async getQueueStatus(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    // Support both short names and full queue names
    const queueMap: Record<string, string> = {
      fulfillment: QueueNames.INTENT_FULFILLMENT,
      execution: QueueNames.INTENT_EXECUTION,
      withdrawal: QueueNames.INTENT_WITHDRAWAL,
      events: QueueNames.BLOCKCHAIN_EVENTS,
    };

    const fullQueueName = queueMap[queueName] || queueName;
    const queue = this.queues.get(fullQueueName) || this.fulfillmentQueue;

    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  async getAllQueueStatuses(): Promise<
    Record<
      string,
      {
        waiting: number;
        active: number;
        completed: number;
        failed: number;
      }
    >
  > {
    const statuses: Record<string, any> = {};

    for (const [queueName, queue] of this.queues) {
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
      ]);

      statuses[queueName] = { waiting, active, completed, failed };
    }

    return statuses;
  }

  /**
   * Check health of all queues
   * Returns true if all queues are connected and not paused
   */
  async checkQueuesHealth(): Promise<{
    healthy: boolean;
    details: Record<string, { connected: boolean; paused: boolean }>;
  }> {
    const details: Record<string, { connected: boolean; paused: boolean }> = {};
    let allHealthy = true;

    for (const [queueName, queue] of this.queues) {
      try {
        const isPaused = await queue.isPaused();
        const client = await queue.client;
        const isConnected = client.status === 'ready';

        details[queueName] = { connected: isConnected, paused: isPaused };

        if (isPaused || !isConnected) {
          allHealthy = false;
        }
      } catch (error) {
        this.logger.error(`Failed to check health for queue ${queueName}:`, toError(error));
        details[queueName] = { connected: false, paused: false };
        allHealthy = false;
      }
    }

    return { healthy: allHealthy, details };
  }

  async addJob(queueName: string, data: any, options?: any): Promise<void> {
    const queue = this.queues.get(queueName) || this.fulfillmentQueue;
    const serializedData = BigintSerializer.serialize(data);
    await queue.add(queueName, serializedData, options);
  }

  async onModuleDestroy() {
    this.logger.log('Gracefully shutting down queues...');

    try {
      // Pause all queues to prevent new jobs from being processed
      await Promise.all(Array.from(this.queues.values()).map((queue) => queue.pause()));

      // Wait for active jobs to complete (with timeout)
      const timeout = 15000; // 15 seconds
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        const activeCounts = await Promise.all(
          Array.from(this.queues.values()).map((queue) => queue.getActiveCount()),
        );

        const totalActive = activeCounts.reduce((sum, count) => sum + count, 0);

        if (totalActive === 0) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Close all queue connections
      await Promise.all(Array.from(this.queues.values()).map((queue) => queue.close()));

      this.logger.log('Queues shutdown completed');
    } catch (error) {
      this.logger.error('Error during queue shutdown:', toError(error));
    }
  }
}
