import { Injectable, Logger } from '@nestjs/common'
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { QUEUES, ANALYTICS_EVENTS } from '@libs/shared'
import { EcoLogMessage, EcoAnalyticsService } from '@libs/shared'

import { Serialize, IntentCreatedLog, Hex } from '@libs/shared'

@Injectable()
@Processor(QUEUES.SOURCE_INTENT.queue, { concurrency: 300 })
export class SolveIntentProcessor extends WorkerHost {
  private logger = new Logger(SolveIntentProcessor.name)

  constructor(
    private readonly createIntentService: any, // CreateIntentService
    private readonly validateIntentService: any, // ValidateIntentService
    private readonly feasableIntentService: any, // FeasableIntentService
    private readonly fulfillIntentService: any, // FulfillIntentService
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
