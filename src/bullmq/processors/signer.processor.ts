import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { QUEUES } from '../../common/redis/constants'
import { Injectable } from '@nestjs/common'
import { Job } from 'bullmq'
import { GenericOperationLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { NonceService } from '../../sign/nonce.service'

@Injectable()
@Processor(QUEUES.SIGNER.queue)
export class SignerProcessor extends WorkerHost {
  private logger = new GenericOperationLogger('SignerProcessor')
  constructor(private readonly nonceService: NonceService) {
    super()
  }

  @LogOperation('processor_job_start', GenericOperationLogger)
  async process(
    @LogContext job: Job<any, any, string>,
    processToken?: string | undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<any> {
    // Business event logging for job start
    this.logger.logProcessorJobStart(
      'SignerProcessor',
      job.id || 'unknown',
      job.data?.intentHash || 'unknown',
    )

    switch (job.name) {
      case QUEUES.SIGNER.jobs.nonce_sync:
        return this.nonceService.syncNonces()
      default:
        this.logger.error(
          { operationType: 'processor_error', status: 'failed' },
          `SignerProcessor: Invalid job type ${job.name}`,
          undefined,
          { jobName: job.name, jobId: job.id },
        )
        return Promise.reject('Invalid job type')
    }
  }

  @OnWorkerEvent('failed')
  @LogOperation('processor_job_failed', GenericOperationLogger)
  onFailed(@LogContext job: Job<any, any, string>, error: Error) {
    // Business event logging for job failure
    this.logger.logProcessorJobFailed('SignerProcessor', job.id || 'unknown', error)
  }

  @OnWorkerEvent('stalled')
  @LogOperation('processor_stalled', GenericOperationLogger)
  onStalled(@LogContext jobId: string, prev?: string) {
    this.logger.warn(
      { operationType: 'processor_stalled', status: 'warning' },
      `SignerProcessor: Job stalled`,
      { jobId, prev },
    )
  }

  @OnWorkerEvent('error')
  @LogOperation('processor_error', GenericOperationLogger)
  onWorkerError(error: Error) {
    this.logger.error(
      { operationType: 'processor_error', status: 'error' },
      `SignerProcessor: Worker error`,
      error,
      { errorName: error.name, errorMessage: error.message },
    )
  }
}
