import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { QUEUES } from '@/common/redis/constants'
import { Injectable } from '@nestjs/common'
import { Job } from 'bullmq'
import { GenericOperationLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { FeasableIntentService } from '@/intent/feasable-intent.service'
import { ValidateIntentService } from '@/intent/validate-intent.service'
import { CreateIntentService } from '@/intent/create-intent.service'
import { FulfillIntentService } from '@/intent/fulfill-intent.service'
import { Hex } from 'viem'
import { IntentCreatedLog } from '@/contracts'
import { Serialize } from '@/common/utils/serialize'
import { EcoAnalyticsService } from '@/analytics'
import { ANALYTICS_EVENTS } from '@/analytics/events.constants'

@Injectable()
@Processor(QUEUES.SOURCE_INTENT.queue, { concurrency: 300 })
export class SolveIntentProcessor extends WorkerHost {
  private logger = new GenericOperationLogger('SolveIntentProcessor')

  constructor(
    private readonly createIntentService: CreateIntentService,
    private readonly validateIntentService: ValidateIntentService,
    private readonly feasableIntentService: FeasableIntentService,
    private readonly fulfillIntentService: FulfillIntentService,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {
    super()
  }

  @LogOperation('processor_job_start', GenericOperationLogger)
  async process(
    @LogContext job: Job<any, any, string>,
    processToken?: string | undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<any> {
    const startTime = Date.now()

    // Log processor job start
    this.logger.logProcessorJobStart(
      'SolveIntentProcessor',
      job.id?.toString() || 'unknown',
      job.data?.intentHash || 'unknown',
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

      // Log processor job completion
      this.logger.logProcessorJobComplete(
        'SolveIntentProcessor',
        job.id?.toString() || 'unknown',
        Date.now() - startTime,
      )

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
      // Log processor job failure
      this.logger.logProcessorJobFailed(
        'SolveIntentProcessor',
        job.id?.toString() || 'unknown',
        error as Error,
      )

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
  @LogOperation('processor_job_failed', GenericOperationLogger)
  onJobFailed(@LogContext job: Job<any, any, string>, @LogContext error: Error) {
    // Log additional failure context from worker event
    this.logger.logProcessorJobFailed(
      'SolveIntentProcessor',
      job.id?.toString() || 'unknown',
      error,
    )
  }

  @OnWorkerEvent('stalled')
  @LogOperation('processor_job_stalled', GenericOperationLogger)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onStalled(@LogContext jobId: string, @LogContext prev?: string) {
    // Log queue processing status for stalled job
    this.logger.logQueueProcessing('SOURCE_INTENT', 1, 'waiting')
  }

  @OnWorkerEvent('error')
  @LogOperation('processor_error', GenericOperationLogger)
  onWorkerError(@LogContext error: Error) {
    // Log infrastructure operation error
    this.logger.logInfrastructureOperation('SolveIntentProcessor', 'worker_processing', false, {
      errorName: error.name,
      errorMessage: error.message,
    })
  }
}
