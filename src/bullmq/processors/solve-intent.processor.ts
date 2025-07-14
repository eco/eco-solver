import { ANALYTICS_EVENTS } from '@/analytics/events.constants'
import { CreateIntentService } from '@/intent/create-intent.service'
import { EcoAnalyticsService } from '@/analytics'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { FeasableIntentService } from '@/intent/feasable-intent.service'
import { FulfillIntentService } from '@/intent/fulfill-intent.service'
import { Injectable, Logger } from '@nestjs/common'
import { IntentCreatedLog } from '@/contracts'
import { Job } from 'bullmq'
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { PublicNegativeIntentRebalanceService } from '@/negative-intents/services/public-negative-intent-rebalance.service'
import { QUEUES } from '@/common/redis/constants'
import { Serialize } from '@/common/utils/serialize'
import { ValidateIntentService } from '@/intent/validate-intent.service'

@Injectable()
@Processor(QUEUES.SOURCE_INTENT.queue, { concurrency: 300 })
export class SolveIntentProcessor extends WorkerHost {
  private logger = new Logger(SolveIntentProcessor.name)

  constructor(
    private readonly createIntentService: CreateIntentService,
    private readonly validateIntentService: ValidateIntentService,
    private readonly feasableIntentService: FeasableIntentService,
    private readonly fulfillIntentService: FulfillIntentService,
    private readonly ecoAnalytics: EcoAnalyticsService,
    private readonly publicNegativeIntentRebalanceService: PublicNegativeIntentRebalanceService,
  ) {
    super()
  }

  async process(
    job: Job<any, any, string>,
    processToken?: string | undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<any> {
    const startTime = Date.now()

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `SolveIntentProcessor: process`,
        properties: {
          job: job.name,
        },
      }),
    )

    // Track job start
    this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.JOB.STARTED, {
      jobName: job.name,
      jobId: job.id,
      jobData: job.data,
      attemptNumber: job.attemptsMade,
    })

    try {
      const result = await this._process(job)

      // Track job completion
      this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.JOB.COMPLETED, {
        jobName: job.name,
        jobId: job.id,
        jobData: job.data,
        result,
        processingTimeMs: Date.now() - startTime,
      })

      return result
    } catch (error) {
      // Track job failure
      this.ecoAnalytics.trackError(ANALYTICS_EVENTS.JOB.FAILED, error, {
        jobName: job.name,
        jobId: job.id,
        jobData: job.data,
        attemptNumber: job.attemptsMade,
        processingTimeMs: Date.now() - startTime,
      })

      throw error
    }
  }

  private async _process(
    job: Job<any, any, string>,
    processToken?: string | undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<any> {
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
        throw new Error(`Unknown job type: ${job.name}`)
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
