import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { Queue } from 'bullmq';

import { toError } from '@/common/utils/error-handler';
import { WithdrawalConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';

@Injectable()
export class WithdrawalScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly schedulerKey = 'check-proven-intents';

  constructor(
    @InjectQueue(QueueNames.INTENT_WITHDRAWAL) private withdrawalQueue: Queue,
    private readonly logger: SystemLoggerService,
    private readonly withdrawalConfigService: WithdrawalConfigService,
  ) {
    this.logger.setContext(WithdrawalScheduler.name);
  }

  async onModuleInit() {
    try {
      // Clean up any existing schedulers first to prevent accumulation
      await this.cleanupExistingSchedulers();

      // Create a new job scheduler for checking proven intents
      const intervalMinutes = this.withdrawalConfigService.checkIntervalMinutes;
      const cronPattern = `*/${intervalMinutes} * * * *`;

      await this.withdrawalQueue.upsertJobScheduler(
        this.schedulerKey,
        {
          pattern: cronPattern,
        },
        {
          name: this.schedulerKey,
          opts: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
            removeOnComplete: {
              age: 3600, // Keep completed jobs for 1 hour
              count: 10, // Keep only last 10 completed jobs (reduced from 100)
            },
            removeOnFail: {
              age: 3600, // Keep failed jobs for 1 hour (reduced from 24 hours)
              count: 50, // Limit failed jobs to prevent accumulation
            },
          },
        },
      );

      this.logger.log(
        `Withdrawal job scheduler created successfully (checking every ${intervalMinutes} minutes)`,
      );
    } catch (error) {
      this.logger.error('Failed to create withdrawal job scheduler', toError(error));
      throw error; // Re-throw to prevent application startup with broken scheduler
    }
  }

  async onModuleDestroy() {
    try {
      await this.cleanupExistingSchedulers();
      this.logger.log('Withdrawal scheduler cleaned up successfully');
    } catch (error) {
      this.logger.error('Failed to cleanup withdrawal scheduler', toError(error));
    }
  }

  /**
   * Clean up any existing schedulers to prevent accumulation
   */
  private async cleanupExistingSchedulers(): Promise<void> {
    try {
      // Remove the scheduler if it exists
      const removed = await this.withdrawalQueue.removeJobScheduler(this.schedulerKey);
      if (removed) {
        this.logger.log('Removed existing withdrawal job scheduler');
      }

      // Clean up any orphaned repeat job keys
      // This is a fallback cleanup in case there are stale repeat jobs
      const client = await this.withdrawalQueue.client;
      const repeatKeys = await client.keys(
        `bull:${QueueNames.INTENT_WITHDRAWAL}:repeat:${this.schedulerKey}:*`,
      );

      if (repeatKeys.length > 0) {
        await client.del(...repeatKeys);
        this.logger.log(`Cleaned up ${repeatKeys.length} orphaned repeat job keys`);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to cleanup existing schedulers (non-critical): ${toError(error).message}`,
      );
      // Don't throw here as this is cleanup - we want to continue with creating new scheduler
    }
  }
}
