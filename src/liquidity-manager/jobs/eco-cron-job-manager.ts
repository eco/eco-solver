import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
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
  private logger: EcoLogger
  private stopRequested = false

  constructor(
    private readonly jobName: string,
    private readonly jobIDPrefix: string,
  ) {
    this.logger = new EcoLogger(`${EcoCronJobManager.name}-${jobName}`)
  }

  /**
   * Starts the cron job.
   * @param queue - The job queue to add the job to.
   * @param interval - Interval duration in which the job is repeated
   * @param walletAddress - Wallet address
   */
  async start(queue: Queue, interval: number, walletAddress: string): Promise<void> {
    this.stopRequested = false

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `starting for walletAddress: ${walletAddress}`,
        properties: {
          queue: queue.name,
          interval,
        },
      }),
    )

    setTimeout(
      async () => {
        while (!this.stopRequested) {
          await this.checkAndEmitDeduped(
            queue,
            walletAddress,
            this.createJobTemplate(walletAddress),
          )
          await this.delay(interval)
        }

        this.logger.log(
          EcoLogMessage.fromDefault({
            message: `stopped for ${walletAddress}`,
          }),
        )
      },
      10,
      this,
    )
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
      data: { wallet: walletAddress },
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
  ): Promise<Job<any, any, string>> {
    const { name: jobName, data: jobData, opts: jobOpts } = jobTemplate

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `checkAndEmitDeduped: adding job for queue: ${queue.name} walletAddress: ${walletAddress}`,
      }),
    )

    const job = await queue.add(jobName, jobData, {
      jobId: `${this.jobIDPrefix}-${walletAddress}`,
      ...jobOpts,
    })

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `checkAndEmitDeduped: job added`,
        properties: {
          job,
        },
      }),
    )

    return job
  }
}
