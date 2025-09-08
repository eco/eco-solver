import { Job as BullMQJob } from 'bullmq'
import { OnWorkerEvent, WorkerHost } from '@nestjs/bullmq'
import { GenericOperationLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { BaseJobManager } from '@/common/bullmq/base-job'

/**
 * Abstract class representing a base processor for liquidity manager jobs.
 * @template Job - The type of the job.
 * @template JobType - The constructor type of the job.
 */
export abstract class BaseProcessor<
  Job extends BullMQJob,
  JobManager extends BaseJobManager<Job> = BaseJobManager<Job>,
> extends WorkerHost {
  public readonly logger: GenericOperationLogger

  /**
   * Constructs a new BaseProcessor.
   * @param name - The name of the processor.
   * @param jobManagers - The array of job managers.
   */
  constructor(
    protected readonly name: string,
    protected readonly jobManagers: JobManager[],
  ) {
    super()
    this.logger = new GenericOperationLogger(name)
  }

  /**
   * Processes a job.
   * @param job - The job to process.
   * @returns The result of the job execution.
   */
  @LogOperation('processor_execution', GenericOperationLogger)
  process(@LogContext job: Job) {
    // Business event logging for job processing
    this.logger.logProcessorJobStart(
      this.name,
      job.id || 'unknown',
      job.data?.intentHash || 'unknown',
    )

    return this.execute(job, 'process')
  }

  /**
   * Hook triggered when a job is completed.
   * @param job - The job that was completed.
   * @returns The result of the onCompleted hook from the job type.
   */
  @OnWorkerEvent('completed')
  @LogOperation('processor_job_complete', GenericOperationLogger)
  onCompleted(@LogContext job: Job) {
    // Business event logging for job completion
    this.logger.logProcessorJobComplete(
      this.name,
      job.id || 'unknown',
      Date.now() - (job.timestamp || 0),
    )

    return this.execute(job, 'onComplete')
  }

  /**
   * Hook triggered when a job fails.
   * @param job - The job that failed.
   * @param error - The error that caused the job to fail.
   * @returns The result of the onFailed hook from the job type.
   */
  @OnWorkerEvent('failed')
  @LogOperation('processor_job_failed', GenericOperationLogger)
  onFailed(@LogContext job: Job, error: Error) {
    // Business event logging for job failure
    this.logger.logProcessorJobFailed(this.name, job.id || 'unknown', error)

    return this.execute(job, 'onFailed', error)
  }

  /**
   * Executes a method on the job type that matches the given job.
   * @param job - The job to execute the method on.
   * @param method - The method to execute.
   * @param params - Additional parameters for the method.
   * @returns The result of the method execution.
   */
  protected execute(job: Job, method: 'process' | 'onFailed' | 'onComplete', ...params: unknown[]) {
    for (const manager of this.jobManagers) {
      // Process the job if it matches the job type
      if (manager.is(job)) {
        return (manager[method] as any)(job, this, ...params)
      }
    }

    this.logger.warn(
      { operationType: 'processor_unknown_job', status: 'warning' },
      `${this.name}: Unknown job type`,
      { jobName: job.name, method, jobId: job.id },
    )

    return undefined
  }
}
