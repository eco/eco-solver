import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { QUEUES } from '@/common/redis/constants'
import { Injectable } from '@nestjs/common'
import { Job } from 'bullmq'
import { GenericOperationLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { FulfillmentLog } from '@/contracts/inbox'

@Injectable()
@Processor(QUEUES.INBOX.queue)
export class InboxProcessor extends WorkerHost {
  private logger = new GenericOperationLogger('InboxProcessor')
  constructor(private readonly utilsIntentService: UtilsIntentService) {
    super()
  }

  @LogOperation('processor_job_start', GenericOperationLogger)
  async process(
    @LogContext job: Job<any, any, string>,
    processToken?: string | undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<any> {
    // Business event logging for job start
    this.logger.logProcessorJobStart(
      'InboxProcessor',
      job.id || 'unknown',
      job.data?.intentHash || 'unknown',
    )

    switch (job.name) {
      case QUEUES.INBOX.jobs.fulfillment:
        return await this.utilsIntentService.updateOnFulfillment(job.data as FulfillmentLog)
      default:
        this.logger.error(
          { operationType: 'processor_error', status: 'failed' },
          `InboxProcessor: Invalid job type ${job.name}`,
          undefined,
          { jobName: job.name, jobId: job.id },
        )
        return Promise.reject('Invalid job type')
    }
  }

  @OnWorkerEvent('failed')
  @LogOperation('processor_job_failed', GenericOperationLogger)
  onJobFailed(@LogContext job: Job<any, any, string>, error: Error) {
    // Business event logging for job failure
    this.logger.logProcessorJobFailed('InboxProcessor', job.id || 'unknown', error)
  }

  @OnWorkerEvent('stalled')
  @LogOperation('processor_stalled', GenericOperationLogger)
  onStalled(@LogContext jobId: string, prev?: string) {
    this.logger.warn(
      { operationType: 'processor_stalled', status: 'warning' },
      `InboxProcessor: Job stalled`,
      { jobId, prev },
    )
  }

  @OnWorkerEvent('error')
  @LogOperation('processor_error', GenericOperationLogger)
  onWorkerError(error: Error) {
    this.logger.error(
      { operationType: 'processor_error', status: 'error' },
      `InboxProcessor: Worker error`,
      error,
      { errorName: error.name, errorMessage: error.message },
    )
  }
}
