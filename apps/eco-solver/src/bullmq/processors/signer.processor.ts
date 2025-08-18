import { Processor, WorkerHost } from '@nestjs/bullmq'
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
}
