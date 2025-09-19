import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { QUEUES } from '@/common/redis/constants'
import { Injectable } from '@nestjs/common'
import { Job } from 'bullmq'
import { GenericOperationLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { RetryInfeasableIntentsService } from '@/intervals/retry-infeasable-intents.service'

@Injectable()
@Processor(QUEUES.INTERVAL.queue)
export class IntervalProcessor extends WorkerHost {
  private logger = new GenericOperationLogger('IntervalProcessor')
  constructor(private readonly retryInfeasableIntentsService: RetryInfeasableIntentsService) {
    super()
  }

  @LogOperation('processor_job_start', GenericOperationLogger)
  async process(
    @LogContext job: Job<any, any, string>,
    processToken?: string | undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<any> {
    // Business event logging for job start
    this.logger.logProcessorJobStart(
      'IntervalProcessor',
      job.id || 'unknown',
      job.data?.intentHash || 'unknown',
    )

    switch (job.name) {
      case QUEUES.INTERVAL.jobs.retry_infeasable_intents:
        return await this.retryInfeasableIntentsService.retryInfeasableIntents()
      default:
        this.logger.error(
          { operationType: 'processor_error', status: 'failed' },
          `IntervalProcessor: Invalid job type ${job.name}`,
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
    this.logger.logProcessorJobFailed('IntervalProcessor', job.id || 'unknown', error)
  }

  @OnWorkerEvent('stalled')
  @LogOperation('processor_stalled', GenericOperationLogger)
  onStalled(@LogContext jobId: string, prev?: string) {
    this.logger.warn(
      { operationType: 'processor_stalled', status: 'warning' },
      `IntervalProcessor: Job stalled`,
      { jobId, prev },
    )
  }

  @OnWorkerEvent('error')
  @LogOperation('processor_error', GenericOperationLogger)
  onWorkerError(error: Error) {
    this.logger.error(
      { operationType: 'processor_error', status: 'error' },
      `IntervalProcessor: Worker error`,
      error,
      { errorName: error.name, errorMessage: error.message },
    )
  }
}
