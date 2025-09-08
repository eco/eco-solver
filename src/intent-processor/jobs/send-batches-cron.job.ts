import { Job, Queue } from 'bullmq'
import { removeJobSchedulers } from '@/bullmq/utils/queue'
import { IntentProcessorJobName } from '@/intent-processor/queues/intent-processor.queue'
import { IntentProcessor } from '@/intent-processor/processors/intent.processor'
import {
  IntentProcessorJob,
  IntentProcessorJobManager,
} from '@/intent-processor/jobs/intent-processor.job'

export type CheckSendBatchJob = Job<undefined, undefined, IntentProcessorJobName.CHECK_SEND_BATCH>

export class CheckSendBatchCronJobManager extends IntentProcessorJobManager {
  static readonly jobSchedulerName = 'job-scheduler-send-batch'

  static async start(queue: Queue, interval: number): Promise<void> {
    await removeJobSchedulers(queue, IntentProcessorJobName.CHECK_SEND_BATCH)

    await queue.upsertJobScheduler(
      CheckSendBatchCronJobManager.jobSchedulerName,
      { every: interval },
      {
        name: IntentProcessorJobName.CHECK_SEND_BATCH,
        opts: {
          removeOnComplete: true,
        },
      },
    )
  }

  is(job: IntentProcessorJob): boolean {
    return job.name === IntentProcessorJobName.CHECK_SEND_BATCH
  }

  async process(job: IntentProcessorJob, processor: IntentProcessor): Promise<void> {
    processor.logger.log(
      {
        operationType: 'cron_job',
        status: 'started',
      },
      `${CheckSendBatchCronJobManager.name}: process`,
    )

    return processor.intentProcessorService.getNextSendBatch()
  }

  onFailed(job: IntentProcessorJob, processor: IntentProcessor, error: unknown) {
    const errorObj = error instanceof Error ? error : new Error(String(error))
    processor.logger.error(
      { operationType: 'job_execution', status: 'failed' },
      `${CheckSendBatchCronJobManager.name}: Failed`,
      errorObj,
      { job_name: CheckSendBatchCronJobManager.name, job_id: job.id, job_data: job.data },
    )
  }
}
