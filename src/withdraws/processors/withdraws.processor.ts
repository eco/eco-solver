import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { InjectQueue, Processor } from '@nestjs/bullmq'
import { WithdrawsJob } from '@/withdraws/jobs/withdraws.job'
import { WithdrawsService } from '@/withdraws/services/withdraws.service'
import { ExecuteWithdrawsJobManager } from '@/withdraws/jobs/execute-withdraws.job'
import { WithdrawRewardsCronJobManager } from '@/withdraws/jobs/withdraw-rewards-cron.job'
import { WithdrawsQueue, WithdrawsQueueType } from '@/withdraws/queues/withdraws.queue'
import { GroupedJobsProcessor } from '@/common/bullmq/grouped-jobs.processor'

/**
 * Processor for handling liquidity manager jobs.
 * Extends the GroupedJobsProcessor to ensure jobs in the same group are not processed concurrently.
 */
@Injectable()
@Processor(WithdrawsQueue.queueName, { concurrency: 10 })
export class WithdrawsProcessor
  extends GroupedJobsProcessor<WithdrawsJob>
  implements OnApplicationBootstrap
{
  protected appReady = false

  /**
   * Constructs a new WithdrawsProcessor.
   * @param queue - The queue to process jobs from.
   * @param withdrawsService - The service for managing liquidity.
   */
  constructor(
    @InjectQueue(WithdrawsQueue.queueName)
    public readonly queue: WithdrawsQueueType,
    public readonly withdrawsService: WithdrawsService,
  ) {
    super('chainId', WithdrawsProcessor.name, [
      new WithdrawRewardsCronJobManager(),
      new ExecuteWithdrawsJobManager(),
    ])
  }

  onApplicationBootstrap(): void {
    this.appReady = true
  }

  protected isAppReady(): boolean {
    return this.appReady
  }
}
