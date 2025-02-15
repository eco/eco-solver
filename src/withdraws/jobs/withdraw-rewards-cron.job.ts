import { Queue } from 'bullmq'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { removeJobSchedulers } from '@/bullmq/utils/queue'
import { WithdrawsJobName } from '@/withdraws/queues/withdraws.queue'
import { WithdrawsProcessor } from '@/withdraws/processors/withdraws.processor'
import { WithdrawsJob, WithdrawsJobManager } from '@/withdraws/jobs/withdraws.job'

export class WithdrawRewardsCronJobManager extends WithdrawsJobManager {
  static readonly jobSchedulerName = 'job-scheduler-withdraws'

  static async start(queue: Queue, interval: number): Promise<void> {
    await removeJobSchedulers(queue, WithdrawsJobName.CHECK_WITHDRAWS)

    await queue.upsertJobScheduler(
      WithdrawRewardsCronJobManager.jobSchedulerName,
      { every: interval },
      {
        name: WithdrawsJobName.CHECK_WITHDRAWS,
        opts: {
          removeOnComplete: true,
        },
      },
    )
  }

  is(job: WithdrawsJob): boolean {
    return job.name === WithdrawsJobName.CHECK_WITHDRAWS
  }

  async process(job: WithdrawsJob, processor: WithdrawsProcessor): Promise<void> {
    processor.logger.log(
      EcoLogMessage.fromDefault({ message: `WithdrawRewardsCronJobManager: process` }),
    )

    return processor.withdrawsService.getNextBatchWithdrawals()
  }

  onFailed(job: WithdrawsJob, processor: WithdrawsProcessor, error: unknown) {
    processor.logger.error(
      EcoLogMessage.fromDefault({
        message: `${WithdrawRewardsCronJobManager.name}: Failed`,
        properties: { error: (error as any)?.message ?? error },
      }),
    )
  }
}
