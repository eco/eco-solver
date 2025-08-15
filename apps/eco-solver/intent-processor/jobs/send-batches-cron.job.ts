import { Queue } from 'bullmq'
import { EcoLogMessage } from '@eco/infrastructure-logging'
import { removeJobSchedulers } from '@/bullmq/utils/queue'
import { IntentProcessorJobName } from '@/intent-processor/constants/job-names'
import { IntentProcessorInterface } from '@/intent-processor/types/processor.interface'
import {
  IntentProcessorJob,
  IntentProcessorJobManager,
  CheckSendBatchJobType as CheckSendBatchJob,
} from '@/intent-processor/types'

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

  async process(job: IntentProcessorJob, processor: IntentProcessorInterface): Promise<void> {
    processor.logger.log(
      EcoLogMessage.fromDefault({ message: `${CheckSendBatchCronJobManager.name}: process` }),
    )

    return processor.intentProcessorService.getNextSendBatch()
  }

  onFailed(job: IntentProcessorJob, processor: IntentProcessorInterface, error: unknown) {
    processor.logger.error(
      EcoLogMessage.fromDefault({
        message: `${CheckSendBatchCronJobManager.name}: Failed`,
        properties: { error: (error as any)?.message ?? error },
      }),
    )
  }
}
