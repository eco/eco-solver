import { Job, Queue } from 'bullmq'
import { removeJobSchedulers } from '@/bullmq/utils/queue'
import { IntentProcessorJobName } from '@/intent-processor/queues/intent-processor.queue'
import { IntentProcessor } from '@/intent-processor/processors/intent.processor'
import {
  IntentProcessorJob,
  IntentProcessorJobManager,
} from '@/intent-processor/jobs/intent-processor.job'

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

  async process(job: IntentProcessorJob, processor: IntentProcessor): Promise<void> {
    processor.logger.log(
      {
        operationType: 'cron_job',
        status: 'started',
      },
      `${CheckWithdrawalsCronJobManager.name}: process`,
    )

    return processor.intentProcessorService.getNextBatchWithdrawals()
  }

  onFailed(job: IntentProcessorJob, processor: IntentProcessor, error: unknown) {
    const errorObj = error instanceof Error ? error : new Error(String(error))
    processor.logger.error(
      { operationType: 'job_execution', status: 'failed' },
      `${CheckWithdrawalsCronJobManager.name}: Failed`,
      errorObj,
      { job_name: CheckWithdrawalsCronJobManager.name, job_id: job.id, job_data: job.data },
    )
  }
}
