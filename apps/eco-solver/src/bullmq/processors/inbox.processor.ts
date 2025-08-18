import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { QUEUES } from '@eco-solver/common/redis/constants'
import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { EcoLogMessage } from '@eco-solver/common/logging/eco-log-message'
import { UtilsIntentService } from '@eco-solver/intent/utils-intent.service'
import { FulfillmentLog } from '@eco-solver/contracts/inbox'

@Injectable()
@Processor(QUEUES.INBOX.queue)
export class InboxProcessor extends WorkerHost {
  private logger = new Logger(InboxProcessor.name)
  constructor(private readonly utilsIntentService: UtilsIntentService) {
    super()
  }

  async process(
    job: Job<any, any, string>,
    processToken?: string | undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<any> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `InboxProcessor: process`,
        properties: {
          job: job.name,
        },
      }),
    )

    switch (job.name) {
      case QUEUES.INBOX.jobs.fulfillment:
        return await this.utilsIntentService.updateOnFulfillment(job.data as FulfillmentLog)
      default:
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `InboxProcessor: Invalid job type ${job.name}`,
          }),
        )
        return Promise.reject('Invalid job type')
    }
  }

  @OnWorkerEvent('failed')
  onJobFailed(job: Job<any, any, string>, error: Error) {
    this.logger.error(
      EcoLogMessage.fromDefault({
        message: `InboxProcessor: Error processing job`,
        properties: {
          job,
          error,
        },
      }),
    )
  }
}
