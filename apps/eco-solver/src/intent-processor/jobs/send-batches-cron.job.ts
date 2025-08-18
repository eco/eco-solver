import { Job, Queue } from 'bullmq'
import { EcoLogMessage } from '@eco-solver/common/logging/eco-log-message'
import { removeJobSchedulers } from '@eco-solver/bullmq/utils/queue'
import { IntentProcessorJobName } from '@eco-solver/intent-processor/queues/intent-processor.queue'
import { IntentProcessor } from '@eco-solver/intent-processor/processors/intent.processor'
import {
  IntentProcessorJob,
  IntentProcessorJobManager,
} from '@eco-solver/intent-processor/jobs/intent-processor.job'

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
      EcoLogMessage.fromDefault({ message: `${CheckSendBatchCronJobManager.name}: process` }),
    )

    return processor.intentProcessorService.getNextSendBatch()
  }

  onFailed(job: IntentProcessorJob, processor: IntentProcessor, error: unknown) {
    processor.logger.error(
      EcoLogMessage.fromDefault({
        message: `${CheckSendBatchCronJobManager.name}: Failed`,
        properties: { error: (error as any)?.message ?? error },
      }),
    )
  }
}
