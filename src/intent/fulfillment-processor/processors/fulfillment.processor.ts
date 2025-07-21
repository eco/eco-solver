/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import { FulfillIntentJob, FulfillIntentJobManager } from '@/intent/fulfillment-processor/job-managers/fulfill-intent-job-manager'
import { FulfillmentProcessorJob } from '@/intent/fulfillment-processor/job-managers/fulfillment-processor-job-manager'
import { FulfillmentProcessorJobName, FulfillmentProcessorQueue, FulfillmentProcessorQueueType } from '@/intent/fulfillment-processor/queues/fulfillment-processor.queue'
import { FulfillmentProcessorService } from '@/intent/fulfillment-processor/services/fulfillment-processor.service'
import { GroupedJobsProcessor } from '@/common/bullmq/grouped-jobs.processor'
import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { InjectQueue, Processor } from '@nestjs/bullmq'

/**
 * Processor for handling liquidity manager jobs.
 * Extends the GroupedJobsProcessor to ensure jobs in the same group are not processed concurrently.
 */
@Injectable()
@Processor(FulfillmentProcessorQueue.name, { concurrency: 10 })
export class FulfillmentProcessor
  extends GroupedJobsProcessor<FulfillIntentJob>
  implements OnApplicationBootstrap
{
  protected appReady = false

  private readonly nonConcurrentJobs: FulfillmentProcessorJobName[] = []

  constructor(
    @InjectQueue(FulfillmentProcessorQueue.name)
    public readonly queue: FulfillmentProcessorQueueType,
    public readonly fulfillmentProcessorService: FulfillmentProcessorService,
  ) {
    super('chainId', FulfillmentProcessor.name, [
      new FulfillIntentJobManager(),
    ])
  }

  async process(job: FulfillmentProcessorJob) {
    if (await this.avoidConcurrency(job)) {
      this.logger.warn('Skipping job execution, queue is not empty.')
      return
    }

    return super.process(job)
  }

  onApplicationBootstrap(): void {
    this.appReady = true
  }

  protected async avoidConcurrency(job: FulfillmentProcessorJob): Promise<boolean> {
    if (this.nonConcurrentJobs.includes(job.name)) {
      return true
    }

    const waitingCount = await this.queue.getWaitingCount()
    const activeCount = await this.queue.getActiveCount()

    if (waitingCount > 0 || activeCount > 1) {
      if (activeCount <= this.nonConcurrentJobs.length) {
        const activeJobs: FulfillmentProcessorJob[] = await this.queue.getActive(
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
