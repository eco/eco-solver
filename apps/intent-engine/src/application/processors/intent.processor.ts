import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { InjectQueue, Processor } from '@nestjs/bullmq'
import { GroupedJobsProcessor } from '@libs/messaging'
import { IntentProcessorService } from '../services/intent-processor.service'
import {
  IntentProcessorJobName,
  IntentProcessorQueue,
  IntentProcessorQueueType,
  IntentProcessorJob,
} from '../queues/intent-processor.queue'
import {
  CheckWithdrawalsCronJobManager,
  CheckSendBatchCronJobManager,
  ExecuteWithdrawsJobManager,
  ExecuteSendBatchJobManager,
} from '../jobs'

/**
 * Processor for handling liquidity manager jobs.
 * Extends the GroupedJobsProcessor to ensure jobs in the same group are not processed concurrently.
 */
@Injectable()
@Processor(IntentProcessorQueue.queueName, { concurrency: 10 })
export class IntentProcessor
  extends GroupedJobsProcessor<IntentProcessorJob>
  implements OnApplicationBootstrap
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
