import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { QUEUES } from '@/common/redis/constants'
import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { FeasableIntentService } from '@/intent/feasable-intent.service'
import { ValidateIntentService } from '@/intent/validate-intent.service'
import { CreateIntentService } from '@/intent/create-intent.service'
import { FulfillIntentService } from '@/intent/fulfill-intent.service'
import { IntentCreatedLog } from '@/contracts'
import { Serialize } from '@/common/utils/serialize'
import { PublicNegativeIntentRebalanceService } from '@/negative-intents/services/public-negative-intent-rebalance.service'

@Injectable()
@Processor(QUEUES.SOURCE_INTENT.queue, { concurrency: 300 })
export class SolveIntentProcessor extends WorkerHost {
  private logger = new Logger(SolveIntentProcessor.name)

  constructor(
    private readonly createIntentService: CreateIntentService,
    private readonly validateIntentService: ValidateIntentService,
    private readonly feasableIntentService: FeasableIntentService,
    private readonly fulfillIntentService: FulfillIntentService,
    private readonly publicNegativeIntentRebalanceService: PublicNegativeIntentRebalanceService,
  ) {
    super()
  }

  async process(
    job: Job<any, any, string>,
    processToken?: string | undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<any> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `SolveIntentProcessor: process`,
        properties: {
          job: job.name,
        },
      }),
    )

    switch (job.name) {
      case QUEUES.SOURCE_INTENT.jobs.create_intent:
        return await this.createIntentService.createIntent(job.data as Serialize<IntentCreatedLog>)

      case QUEUES.SOURCE_INTENT.jobs.validate_intent:
      case QUEUES.SOURCE_INTENT.jobs.retry_intent:
        return await this.validateIntentService.validateIntent(job.data)

      case QUEUES.SOURCE_INTENT.jobs.feasable_intent:
        return await this.feasableIntentService.feasableIntent(job.data)

      case QUEUES.SOURCE_INTENT.jobs.fulfill_intent:
        return await this.fulfillIntentService.fulfill(job.data)

      case QUEUES.SOURCE_INTENT.jobs.proven_intent:
        return await this.publicNegativeIntentRebalanceService.processIntentProven(job.data)

      default:
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `SolveIntentProcessor: Invalid job type ${job.name}`,
          }),
        )
        return Promise.reject('Invalid job type')
    }
  }

  @OnWorkerEvent('failed')
  onJobFailed(job: Job<any, any, string>, error: Error) {
    this.logger.error(
      EcoLogMessage.fromDefault({
        message: `SolveIntentProcessor: Error processing job`,
        properties: {
          job,
          error,
        },
      }),
    )
  }
}
