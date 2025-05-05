import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { QUEUES } from '@/common/redis/constants'
import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { HatsService } from '@/hats/hats.service'

@Injectable()
@Processor(QUEUES.HATS.queue)
export class HatsProcessor extends WorkerHost {
  private logger = new Logger(HatsProcessor.name)
  constructor(private readonly hatsService: HatsService) {
    super()
  }

  async process(
    job: Job<any, any, string>,
    processToken?: string | undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<any> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `HatsProcessor: process`,
        properties: {
          job: job.name,
        },
      }),
    )

    switch (job.name) {
      case QUEUES.HATS.jobs.distribute:
        return await this.hatsService.executeDistribution(job.data.accumulationPeriodId, job.data.rewardPeriodId)
      default:
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `HatsProcessor: Invalid job type ${job.name}`,
          }),
        )
        return Promise.reject('Invalid job type')
    }
  }

  @OnWorkerEvent('failed')
  onWorkerError(error: Error) {
    this.logger.error(
      EcoLogMessage.fromDefault({
        message: `HatsProcessor: Error processing job`,
        properties: {
          error,
        },
      }),
    )
  }
}