import { LiquidityManagerLogger } from '@/common/logging/loggers'
import { EcoResponse } from '@/common/eco-response'
import { Queue, JobSchedulerTemplateOptions, Job } from 'bullmq'

interface JobTemplate {
  name: string
  data: any
  opts: JobSchedulerTemplateOptions
}

/*
 * Base class for managing cron jobs in the liquidity manager.
 * Provides methods to start, stop, and manage job scheduling.
 */
export class EcoCronJobManager {
  private logger: LiquidityManagerLogger
  private started: boolean = false
  private stopRequested: boolean = false

  constructor(
    private readonly jobName: string,
    private readonly jobIDPrefix: string,
  ) {
    this.logger = new LiquidityManagerLogger(`${EcoCronJobManager.name}-${jobName}`)
  }

  /**
   * Starts the cron job.
   * @param queue - The job queue to add the job to.
   * @param interval - Interval duration in which the job is repeated
   * @param walletAddress - Wallet address
   */
  async start(queue: Queue, interval: number, walletAddress: string): Promise<void> {
    if (this.started) {
      this.logger.warn(
        {
          rebalanceId: 'cron-manager',
          walletAddress,
          strategy: 'check-balances',
        },
        `start() called again while already running for walletAddress: ${walletAddress} — ignoring`,
      )
      return
    }

    this.started = true
    this.stopRequested = false

    this.logger.log(
      {
        rebalanceId: this.jobIDPrefix,
        walletAddress,
        strategy: 'check-balances',
      },
      `start: walletAddress: ${walletAddress}`,
      {
        queueName: queue.name,
        queuePrefix: (queue as any)?.opts?.prefix,
        interval,
        jobSchedulerId: this.jobIDPrefix,
        workerName: 'CheckBalancesProcessor',
      },
    )

    setImmediate(async () => {
      try {
        const jobTemplate = this.createJobTemplate(walletAddress)

        while (!this.stopRequested) {
          await this.checkAndEmitDeduped(queue, walletAddress, jobTemplate)
          await this.delay(interval)
        }

        this.logger.log(
          {
            rebalanceId: this.jobIDPrefix,
            walletAddress,
            strategy: 'check-balances',
          },
          `stopped for walletAddress: ${walletAddress}`,
        )
      } finally {
        this.started = false
      }
    })
  }

  stop() {
    this.stopRequested = true
  }

  private async delay(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  private createJobTemplate(walletAddress: string): JobTemplate {
    return {
      name: this.jobName,
      data: {
        wallet: walletAddress,
      },
      opts: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    }
  }

  private async checkAndEmitDeduped(
    queue: Queue,
    walletAddress: string,
    jobTemplate: JobTemplate,
  ): Promise<EcoResponse<Job<any, any, string>>> {
    try {
      const { name: jobName, data: jobData, opts: jobOpts } = jobTemplate

      const job = await queue.add(jobName, jobData, {
        jobId: `${this.jobIDPrefix}`,
        ...jobOpts,
      })

      this.logger.log(
        {
          rebalanceId: this.jobIDPrefix,
          walletAddress,
          strategy: 'check-balances',
        },
        `checkAndEmitDeduped: job added walletAddress: ${walletAddress}`,
        {
          jobId: job.id,
          queue: queue.name,
          queuePrefix: (queue as any)?.opts?.prefix,
          jobSchedulerId: this.jobIDPrefix,
          workerName: 'CheckBalancesProcessor',
        },
      )

      return { response: job }
    } catch (ex) {
      this.logger.error(
        {
          rebalanceId: this.jobIDPrefix,
          walletAddress,
          strategy: 'check-balances',
        },
        `checkAndEmitDeduped: error adding job`,
        ex,
        {
          queue: queue.name,
        },
      )

      return { error: ex }
    }
  }
}
