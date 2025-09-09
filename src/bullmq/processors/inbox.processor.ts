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

    switch (job.name) {
      case QUEUES.INBOX.jobs.fulfillment:
        return await this.utilsIntentService.updateOnFulfillment(job.data as FulfillmentLog)
      default:
        throw new Error(`Unknown job type: ${job.name}`)
        return Promise.reject('Invalid job type')
    }
  }

  @OnWorkerEvent('failed')
  @LogOperation('processor_job_failed', GenericOperationLogger)
  onJobFailed(@LogContext job: Job<any, any, string>, error: Error) {
  }

  @OnWorkerEvent('stalled')
  @LogOperation('processor_stalled', GenericOperationLogger)
  onStalled(@LogContext jobId: string, prev?: string) {
  }

  @OnWorkerEvent('error')
  @LogOperation('processor_error', GenericOperationLogger)
  onWorkerError(error: Error) {
  }
}
