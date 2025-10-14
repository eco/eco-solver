import { Queue } from 'bullmq'
import { BullModule } from '@nestjs/bullmq'
import { LiquidityManagerLogger } from '@/common/logging/loggers'
import { CheckBalancesCronJobManager } from '@/liquidity-manager/jobs/check-balances-cron.job'
import { LogContext, LogOperation } from '@/common/logging'

import { CHECK_BALANCES_QUEUE_NAME } from '@/liquidity-manager/constants/queue.constants'

// Re-export constant for use in tests and other modules
export { CHECK_BALANCES_QUEUE_NAME }

export class CheckBalancesQueue {
  public static readonly prefix = '{check-balances}'
  public static readonly queueName = CHECK_BALANCES_QUEUE_NAME
  private readonly logger = new LiquidityManagerLogger('CheckBalancesQueue')

  constructor(private readonly queue: Queue) {}

  static init() {
    return BullModule.registerQueue({
      name: this.queueName,
      prefix: this.prefix,
      defaultJobOptions: {
        removeOnFail: true,
        removeOnComplete: true,
      },
    })
  }

  get name() {
    return this.queue.name
  }
  @LogOperation('start_cron_jobs', LiquidityManagerLogger)
  startCronJobs(
    @LogContext interval: number,
    @LogContext walletAddress: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @LogContext queueName = this.queue.name,
  ): Promise<void> {
    // this.logger.log(
    //   {
    //     rebalanceId: 'check-balances-queue',
    //     walletAddress,
    //     strategy: 'check-balances',
    //   },
    //   'startCronJobs called',
    //   { queue: this.queue.name, intervalMs: interval },
    // )
    return CheckBalancesCronJobManager.start(this.queue, interval, walletAddress)
  }
}
