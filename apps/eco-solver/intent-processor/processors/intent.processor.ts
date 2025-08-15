import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { InjectQueue, Processor } from '@nestjs/bullmq'
import { IntentProcessorJob } from '@/intent-processor/jobs/intent-processor.job'
import { IntentProcessorService } from '@/intent-processor/services/intent-processor.service'
import { ExecuteWithdrawsJobManager } from '@/intent-processor/jobs/execute-withdraws.job'
import { CheckSendBatchCronJobManager } from '@/intent-processor/jobs/send-batches-cron.job'
import { CheckWithdrawalsCronJobManager } from '@/intent-processor/jobs/withdraw-rewards-cron.job'
import {
  IntentProcessorJobName,
  IntentProcessorQueue,
  IntentProcessorQueueType,
} from '@/intent-processor/queues/intent-processor.queue'
import { GroupedJobsProcessor } from '@/common/bullmq/grouped-jobs.processor'
import { ExecuteSendBatchJobManager } from '@/intent-processor/jobs/execute-send-batch.job'
import { IntentProcessorInterface } from '@/intent-processor/types/processor.interface'

/**
 * Processor for handling liquidity manager jobs.
 * Extends the GroupedJobsProcessor to ensure jobs in the same group are not processed concurrently.
 */
@Injectable()
@Processor(IntentProcessorQueue.queueName, { concurrency: 10 })
export class IntentProcessor
  extends GroupedJobsProcessor<IntentProcessorJob>
  implements OnApplicationBootstrap, IntentProcessorInterface
{
  protected appReady = false

  private readonly nonConcurrentJobs: IntentProcessorJobName[] = [
    IntentProcessorJobName.CHECK_SEND_BATCH,
    IntentProcessorJobName.CHECK_WITHDRAWS,
  ]

  constructor(
    @InjectQueue(IntentProcessorQueue.queueName)
    public readonly queue: IntentProcessorQueueType,
    public readonly intentProcessorService: IntentProcessorService,
  ) {
    super('chainId', IntentProcessor.name, [
      new CheckWithdrawalsCronJobManager(),
      new CheckSendBatchCronJobManager(),
      new ExecuteWithdrawsJobManager(),
      new ExecuteSendBatchJobManager(),
    ])
  }

  async process(job: IntentProcessorJob) {
    if (await this.avoidConcurrency(job)) {
      this.logger.warn('Skipping job execution, queue is not empty.')
      return
    }

    return super.process(job)
  }

  onApplicationBootstrap(): void {
    this.appReady = true
  }

  protected async avoidConcurrency(job: IntentProcessorJob): Promise<boolean> {
    if (!this.nonConcurrentJobs.includes(job.name)) {
      return false
    }

    const waitingCount = await this.queue.getWaitingCount()
    const activeCount = await this.queue.getActiveCount()

    if (waitingCount > 0 || activeCount > 1) {
      if (activeCount <= this.nonConcurrentJobs.length) {
        const activeJobs: IntentProcessorJob[] = await this.queue.getActive(
          0,
          this.nonConcurrentJobs.length,
        )
        const jobNames = activeJobs.map((job) => job.name)
        return !jobNames.every((jobName) => this.nonConcurrentJobs.includes(jobName))
      }

      return true
    }

    return false
  }

  protected isAppReady(): boolean {
    return this.appReady
  }
}
