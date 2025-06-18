import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { QUEUES } from '@/common/redis/constants'
import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { BalanceTrackerService } from '../balance-tracker-mongo.service'
import { BALANCE_MONITOR_JOBS } from '../jobs/balance-monitor.job'

/**
 * BullMQ processor for balance tracking initialization jobs only
 * Balance updates are now handled directly in MongoDB
 */
@Injectable()
@Processor(QUEUES.BALANCE_MONITOR.queue)
export class BalanceTrackerProcessor extends WorkerHost {
  private readonly logger = new Logger(BalanceTrackerProcessor.name)

  constructor(private readonly balanceTrackerService: BalanceTrackerService) {
    super()
  }

  async process(
    job: Job<any, any, string>,
    processToken?: string | undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<any> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `BalanceTrackerProcessor: Processing job`,
        properties: {
          jobName: job.name,
          jobId: job.id,
          attempt: job.attemptsMade + 1,
        },
      }),
    )

    try {
      switch (job.name) {
        case BALANCE_MONITOR_JOBS.initialize_monitoring:
          return await this.processInitializeTracking(job)

        default:
          const errorMsg = `BalanceTrackerProcessor: Invalid job type ${job.name}`
          this.logger.error(
            EcoLogMessage.fromDefault({
              message: errorMsg,
              properties: {
                jobName: job.name,
                jobId: job.id,
              },
            }),
          )
          throw new Error(errorMsg)
      }
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `BalanceTrackerProcessor: Error processing job`,
          properties: {
            jobName: job.name,
            jobId: job.id,
            error: error.message,
            attempt: job.attemptsMade + 1,
          },
        }),
      )
      throw error
    }
  }

  /**
   * Processes balance tracker initialization job
   */
  private async processInitializeTracking(job: Job): Promise<void> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'BalanceTrackerProcessor: Initializing balance tracking',
        properties: {
          jobId: job.id,
        },
      }),
    )

    const startTime = Date.now()

    try {
      await this.balanceTrackerService.initializeBalanceTracking()

      const duration = Date.now() - startTime
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'BalanceTrackerProcessor: Balance tracking initialization completed',
          properties: {
            jobId: job.id,
            duration,
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceTrackerProcessor: Failed to initialize balance tracking',
          properties: {
            jobId: job.id,
            error: error.message,
            duration: Date.now() - startTime,
          },
        }),
      )
      throw error
    }
  }

  /**
   * Handles job completion events
   */
  @OnWorkerEvent('completed')
  onJobCompleted(job: Job<any, any, string>, result: any) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `BalanceTrackerProcessor: Job completed`,
        properties: {
          jobName: job.name,
          jobId: job.id,
          result: typeof result === 'object' ? JSON.stringify(result) : result,
        },
      }),
    )
  }

  /**
   * Handles job failure events
   */
  @OnWorkerEvent('failed')
  onJobFailed(job: Job<any, any, string>, error: Error) {
    this.logger.error(
      EcoLogMessage.fromDefault({
        message: `BalanceTrackerProcessor: Job failed`,
        properties: {
          jobName: job.name,
          jobId: job.id,
          error: error.message,
          attempt: job.attemptsMade,
          maxAttempts: job.opts.attempts,
        },
      }),
    )
  }

  /**
   * Handles job stalling events
   */
  @OnWorkerEvent('stalled')
  onJobStalled(jobId: string) {
    this.logger.warn(
      EcoLogMessage.fromDefault({
        message: `BalanceTrackerProcessor: Job stalled`,
        properties: {
          jobId,
        },
      }),
    )
  }
}
