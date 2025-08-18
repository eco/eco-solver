import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { QUEUES } from '@eco-solver/common/redis/constants'
import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { EcoLogMessage } from '@eco-solver/common/logging/eco-log-message'
import { FeasableIntentService } from '@eco-solver/intent/feasable-intent.service'
import { ValidateIntentService } from '@eco-solver/intent/validate-intent.service'
import { CreateIntentService } from '@eco-solver/intent/create-intent.service'
import { FulfillIntentService } from '@eco-solver/intent/fulfill-intent.service'
import { Hex } from 'viem'
import { IntentCreatedLog } from '@eco-solver/contracts'
import { Serialize } from '@eco-solver/common/utils/serialize'
import { EcoAnalyticsService } from '@eco-solver/analytics'
import { ANALYTICS_EVENTS } from '@eco-solver/analytics/events.constants'

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
      let result: any

      switch (job.name) {
        case QUEUES.SOURCE_INTENT.jobs.create_intent:
          result = await this.createIntentService.createIntent(
            job.data as Serialize<IntentCreatedLog>,
          )
          break
        case QUEUES.SOURCE_INTENT.jobs.validate_intent:
        case QUEUES.SOURCE_INTENT.jobs.retry_intent:
          result = await this.validateIntentService.validateIntent(job.data as Hex)
          break
        case QUEUES.SOURCE_INTENT.jobs.feasable_intent:
          result = await this.feasableIntentService.feasableIntent(job.data as Hex)
          break
        default:
          throw new Error(`Unknown job type: ${job.name}`)
      }

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
