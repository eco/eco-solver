import { Queue } from 'bullmq'
import { initBullMQ } from '@/bullmq/bullmq.helper'
import { LiquidityManagerLogger } from '@/common/logging/loggers'
import { CheckBalancesCronJobManager } from '@/liquidity-manager/jobs/check-balances-cron.job'

export class CheckBalancesQueue {
  public static readonly prefix = '{check-balances}'
  public static readonly queueName = CheckBalancesQueue.name
  private readonly logger = new LiquidityManagerLogger('CheckBalancesQueue')

  constructor(private readonly queue: Queue) {}

  static init() {
    return initBullMQ(
      { queue: this.queueName, prefix: this.prefix },
      {
        defaultJobOptions: {
          removeOnFail: true,
          removeOnComplete: true,
        },
      },
    )
  }

  get name() {
    return this.queue.name
  }

  startCronJobs(interval: number, walletAddress: string): Promise<void> {
    this.logger.log(
      {
        rebalanceId: 'check-balances-queue',
        walletAddress,
        strategy: 'check-balances',
      },
      'startCronJobs called',
      { queue: this.queue.name, intervalMs: interval },
    )
    return CheckBalancesCronJobManager.start(this.queue, interval, walletAddress)
  }
}
