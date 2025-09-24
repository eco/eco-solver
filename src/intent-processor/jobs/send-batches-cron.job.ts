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

  @LogOperation('job_execution', GenericOperationLogger)
  async process(@LogContext job: IntentProcessorJob, processor: IntentProcessor): Promise<void> {
    return processor.intentProcessorService.getNextSendBatch()
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
