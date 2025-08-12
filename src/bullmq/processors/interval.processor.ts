import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { QUEUES } from '@/common/redis/constants'
import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { RetryInfeasableIntentsService } from '@/intervals/retry-infeasable-intents.service'

@Injectable()
@Processor(QUEUES.INTERVAL.queue)
export class IntervalProcessor extends WorkerHost {
  private logger = new Logger(IntervalProcessor.name)
  constructor(private readonly retryInfeasableIntentsService: RetryInfeasableIntentsService) {
    super()
  }

  async process(
    job: Job<any, any, string>,
    processToken?: string | undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<any> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `IntervalProcessor: process`,
        properties: {
          job: job.name,
        },
      }),
    )

    switch (job.name) {
      case QUEUES.INTERVAL.jobs.retry_infeasable_intents:
        return await this.retryInfeasableIntentsService.retryInfeasableIntents()
      default:
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `IntervalProcessor: Invalid job type ${job.name}`,
          }),
        )
        return Promise.reject('Invalid job type')
    }
  }

  @OnWorkerEvent('failed')
  onJobFailed(job: Job<any, any, string>, error: Error) {
    this.logger.error(
      EcoLogMessage.fromDefault({
        message: `IntervalProcessor: Error processing job`,
        properties: {
          job,
          error,
        },
      }),
    )
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string, prev?: string) {
    this.logger.warn(
      EcoLogMessage.fromDefault({
        message: `IntervalProcessor: Job stalled`,
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
      EcoLogMessage.fromDefault({
        message: `IntervalProcessor: Worker error`,
        properties: {
          error,
        },
      }),
    )
  }
}
