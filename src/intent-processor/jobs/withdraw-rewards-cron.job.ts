import { Job, Queue } from 'bullmq'
import { removeJobSchedulers } from '@/bullmq/utils/queue'
import { IntentProcessorJobName } from '@/intent-processor/queues/intent-processor.queue'
import { IntentProcessor } from '@/intent-processor/processors/intent.processor'
import {
  IntentProcessorJob,
  IntentProcessorJobManager,
} from '@/intent-processor/jobs/intent-processor.job'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { GenericOperationLogger } from '@/common/logging/loggers'

export type CheckWithdrawsCronJob = Job<
  undefined,
  undefined,
  IntentProcessorJobName.CHECK_WITHDRAWS
>

export class CheckWithdrawalsCronJobManager extends IntentProcessorJobManager {
  static readonly jobSchedulerName = 'job-scheduler-withdraws'

  static async start(queue: Queue, interval: number): Promise<void> {
    await removeJobSchedulers(queue, IntentProcessorJobName.CHECK_WITHDRAWS)

    // Delay 5 seconds to avoid parallel execution with send batch cron job
    await new Promise((res) => setTimeout(res, 5_000))

    await queue.upsertJobScheduler(
      CheckWithdrawalsCronJobManager.jobSchedulerName,
      { every: interval },
      {
        name: IntentProcessorJobName.CHECK_WITHDRAWS,
        opts: {
          removeOnComplete: true,
        },
      },
    )
  }

  is(job: IntentProcessorJob): boolean {
    return job.name === IntentProcessorJobName.CHECK_WITHDRAWS
  }

  @LogOperation('job_execution', GenericOperationLogger)
  async process(@LogContext job: IntentProcessorJob, processor: IntentProcessor): Promise<void> {
    return processor.intentProcessorService.getNextBatchWithdrawals()
  }

  @LogOperation('job_execution', GenericOperationLogger)
  onFailed(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @LogContext job: IntentProcessorJob,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    processor: IntentProcessor,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @LogContext error: unknown,
  ) {
    // Error details are automatically captured by the decorator
    // No need to re-throw the error as it's already been processed
  }
}
