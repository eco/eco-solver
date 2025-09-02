import { Queue } from 'bullmq'
import { initBullMQ } from '@/bullmq/bullmq.helper'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { CheckBalancesCronJobManager } from '@/liquidity-manager/jobs/check-balances-cron.job'

export class CheckBalancesQueue {
  public static readonly prefix = '{check-balances}'
  public static readonly queueName = CheckBalancesQueue.name
  private readonly logger = new EcoLogger(CheckBalancesQueue.name)

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
      EcoLogMessage.fromDefault({
        message: 'startCronJobs called',
        properties: { queue: this.queue.name, intervalMs: interval, walletAddress },
      }),
    )
    return CheckBalancesCronJobManager.start(this.queue, interval, walletAddress)
  }
}
