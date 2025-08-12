import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { QUEUES } from '../../common/redis/constants'
import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { EcoLogMessage } from '../../common/logging/eco-log-message'
import { NonceService } from '../../sign/nonce.service'

@Injectable()
@Processor(QUEUES.SIGNER.queue)
export class SignerProcessor extends WorkerHost {
  private logger = new Logger(SignerProcessor.name)
  constructor(private readonly nonceService: NonceService) {
    super()
  }

  async process(
    job: Job<any, any, string>,
    processToken?: string | undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<any> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `SignerProcessor: process`,
        properties: {
          job: job.name,
        },
      }),
    )

    switch (job.name) {
      case QUEUES.SIGNER.jobs.nonce_sync:
        return this.nonceService.syncNonces()
      default:
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `SignerProcessor: Invalid job type ${job.name}`,
          }),
        )
        return Promise.reject('Invalid job type')
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<any, any, string>, error: Error) {
    this.logger.error(
      EcoLogMessage.withError({
        message: `SignerProcessor: Error processing job`,
        error,
        properties: { job },
      }),
    )
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string, prev?: string) {
    this.logger.warn(
      EcoLogMessage.fromDefault({
        message: `SignerProcessor: Job stalled`,
        properties: {
          jobId,
          prev,
        },
      }),
    )
  }

  @OnWorkerEvent('error')
  onWorkerError(error: Error) {
    this.logger.error(
      EcoLogMessage.withError({
        message: `SignerProcessor: Worker error`,
        error,
      }),
    )
  }
}
