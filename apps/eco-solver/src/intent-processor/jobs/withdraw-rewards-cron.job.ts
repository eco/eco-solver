import { Job, Queue } from 'bullmq'
import { EcoLogMessage } from '../../common/logging/eco-log-message'
import { removeJobSchedulers } from '../../bullmq/utils/queue'
import { IntentProcessorJobName } from '../queues/intent-processor.queue'
import { IntentProcessor } from '../processors/intent.processor'
import {
  IntentProcessorJob,
  IntentProcessorJobManager,
} from './intent-processor.job'

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
      EcoLogMessage.fromDefault({ message: `${CheckWithdrawalsCronJobManager.name}: process` }),
    )

    return processor.intentProcessorService.getNextBatchWithdrawals()
  }

  onFailed(job: IntentProcessorJob, processor: IntentProcessor, error: unknown) {
    processor.logger.error(
      EcoLogMessage.fromDefault({
        message: `${CheckWithdrawalsCronJobManager.name}: Failed`,
        properties: {
          error: (error as any)?.message ?? error,
          stack: (error as any)?.stack,
        },
      }),
    )
  }
}
