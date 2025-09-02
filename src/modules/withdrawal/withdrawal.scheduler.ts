import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';

import { Queue } from 'bullmq';

import { toError } from '@/common/utils/error-handler';
import { WithdrawalConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';

@Injectable()
export class WithdrawalScheduler implements OnModuleInit {
  constructor(
    @InjectQueue(QueueNames.INTENT_WITHDRAWAL) private withdrawalQueue: Queue,
    private readonly logger: SystemLoggerService,
    private readonly withdrawalConfigService: WithdrawalConfigService,
  ) {
    this.logger.setContext(WithdrawalScheduler.name);
  }

  async onModuleInit() {
    // Create a job scheduler for checking proven intents
    try {
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

      this.logger.log(
        `Withdrawal job scheduler created successfully (checking every ${intervalMinutes} minutes)`,
      );
    } catch (error) {
      this.logger.error('Failed to create withdrawal job scheduler', toError(error));
    }
  }
}
