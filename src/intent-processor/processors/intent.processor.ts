import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { InjectQueue, Processor } from '@nestjs/bullmq'
import { GenericOperationLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { IntentProcessorJob } from '@/intent-processor/jobs/intent-processor.job'
import { IntentProcessorService } from '@/intent-processor/services/intent-processor.service'
import { ExecuteWithdrawsJobManager } from '@/intent-processor/jobs/execute-withdraws.job'
import { CheckSendBatchCronJobManager } from '@/intent-processor/jobs/send-batches-cron.job'
import { CheckWithdrawalsCronJobManager } from '@/intent-processor/jobs/withdraw-rewards-cron.job'
import {
  IntentProcessorJobName,
  IntentProcessorQueueType,
} from '@/intent-processor/queues/intent-processor.queue'
import { QUEUES } from '@/common/redis/constants'
import { GroupedJobsProcessor } from '@/common/bullmq/grouped-jobs.processor'
import { ExecuteSendBatchJobManager } from '@/intent-processor/jobs/execute-send-batch.job'

/**
 * Processor for handling liquidity manager jobs.
 * Extends the GroupedJobsProcessor to ensure jobs in the same group are not processed concurrently.
 */
@Injectable()
@Processor(QUEUES.INTENT_PROCESSOR.queue, { concurrency: 10 })
export class IntentProcessor
  extends GroupedJobsProcessor<IntentProcessorJob>
  implements OnApplicationBootstrap
{
  private businessLogger = new GenericOperationLogger('IntentProcessor')
  protected appReady = false

  private readonly nonConcurrentJobs: IntentProcessorJobName[] = [
    IntentProcessorJobName.CHECK_SEND_BATCH,
    IntentProcessorJobName.CHECK_WITHDRAWS,
  ]

  constructor(
    @InjectQueue(QUEUES.INTENT_PROCESSOR.queue)
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

  @LogOperation('processor_job_start', GenericOperationLogger)
  async process(@LogContext job: IntentProcessorJob) {
    if (await this.avoidConcurrency(job)) {
      // Log business event for job skipping due to concurrency
      this.businessLogger.logQueueProcessing('IntentProcessorQueue', 1, 'waiting')
      return
    }

    // Log business event for job processing start
    this.businessLogger.logProcessorJobStart(
      'IntentProcessor',
      job.id || 'unknown',
      job.name || 'unknown',
    )

    return super.process(job)
  }

  @LogOperation('processor_execution', GenericOperationLogger)
  onApplicationBootstrap(): void {
    this.appReady = true
  }

  @LogOperation('processor_execution', GenericOperationLogger)
  protected async avoidConcurrency(@LogContext job: IntentProcessorJob): Promise<boolean> {
    if (!this.nonConcurrentJobs.includes(job.name)) {
      return false
    }

    const waitingCount = await this.queue.getWaitingCount()
    const activeCount = await this.queue.getActiveCount()

    if (waitingCount > 0 || activeCount > 1) {
      if (activeCount <= this.nonConcurrentJobs.length) {
        const activeJobs = (await this.queue.getActive(
          0,
          this.nonConcurrentJobs.length,
        )) as IntentProcessorJob[]
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
