import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { Queue } from 'bullmq';

import { toError } from '@/common/utils/error-handler';
import { WithdrawalConfigService } from '@/modules/config/services';
import { Logger } from '@/modules/logging';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';

@Injectable()
export class WithdrawalScheduler implements OnModuleInit, OnModuleDestroy {
  constructor(
    @InjectQueue(QueueNames.INTENT_WITHDRAWAL) private readonly withdrawalQueue: Queue,
    private readonly withdrawalConfigService: WithdrawalConfigService,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(WithdrawalScheduler.name);
  }

  async onModuleInit() {
    // Create a job scheduler for checking proven intents
    try {
      this.logger.info('Starting withdrawal job scheduler');

      const intervalMinutes = this.withdrawalConfigService.checkIntervalMinutes;
      const cronPattern = `*/${intervalMinutes} * * * *`;

      await this.withdrawalQueue.upsertJobScheduler(
        'check-proven-intents',
        {
          pattern: cronPattern,
        },
        {
          name: 'check-proven-intents',
          opts: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
            removeOnComplete: {
              age: 3600, // Keep completed jobs for 1 hour
              count: 100, // Keep last 100 completed jobs
            },
            removeOnFail: {
              age: 86400, // Keep failed jobs for 24 hours
            },
          },
        },
      );

      this.logger.info('Withdrawal job scheduler created successfully', {
        intervalMinutes,
      });
    } catch (error) {
      this.logger.error('Failed to create withdrawal job scheduler', {
        error: toError(error),
      });
    }
  }

  async onModuleDestroy() {
    // Remove the job scheduler to ensure clean shutdown
    try {
      this.logger.info('Removing withdrawal job scheduler');
      await this.withdrawalQueue.removeJobScheduler('check-proven-intents');
      this.logger.info('Withdrawal job scheduler removed');
    } catch (error) {
      this.logger.error('Failed to remove withdrawal job scheduler', {
        error: toError(error),
      });
    }
  }
}
