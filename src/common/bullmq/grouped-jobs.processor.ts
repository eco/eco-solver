import { BaseProcessor } from '@/common/bullmq/base.processor'
import { Job, Queue } from 'bullmq'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { OnWorkerEvent } from '@nestjs/bullmq'
import { BaseJobManager } from '@/common/bullmq/base-job'

// Extract keys from `data` when `data` is defined
type DataKeys<T> = T extends { data?: infer D } ? (D extends object ? keyof D : never) : never

/**
 * Abstract class representing a processor for grouped jobs.
 * @template Job - The type of the job.
 */
export abstract class GroupedJobsProcessor<
  GroupJob extends Job = Job,
  JobManager extends BaseJobManager<GroupJob> = BaseJobManager<GroupJob>,
> extends BaseProcessor<GroupJob, JobManager> {
  protected abstract readonly queue: Queue

  protected readonly activeGroups = new Set<string>()

  /**
   * Constructs a new GroupedJobsProcessor.
   * @param groupBy - The property to group jobs by.
   * @param params - Additional parameters for the base processor.
   */
  constructor(
    protected readonly groupBy: DataKeys<GroupJob>,
    ...params: ConstructorParameters<typeof BaseProcessor<Job, JobManager>>
  ) {
    super(...params)
  }

  /**
   * Processes a job, ensuring that jobs in the same group are not processed concurrently.
   * @param job - The job to process.
   * @returns A promise that resolves to an object indicating if the job was delayed.
   */
  async process(job: GroupJob) {
    const group = job.data?.[this.groupBy] as string

    if (group) {
      if (this.activeGroups.has(group)) {
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: 'Job delayed due to group concurrency',
            properties: {
              jobName: job.name,
              group,
            },
          }),
        )

        await this.queue.add(job.name, job.data, {
          ...job.opts,
          delay: 5_000, // Delay for 5 seconds
        })

        return { delayed: true }
      }

      this.activeGroups.add(group)
    }

    return super.process(job)
  }

  /**
   * Hook triggered when a job is completed.
   * @param job - The job that was completed.
   */
  @OnWorkerEvent('completed')
  onCompleted(job: GroupJob) {
    const returnvalue = job.returnvalue as object
    if (returnvalue && 'delayed' in returnvalue && returnvalue.delayed) {
      // Skip onCompleted hook if job got delayed
      return
    } else if (
      this.groupBy in job.data &&
      this.activeGroups.has(job.data[this.groupBy] as string)
    ) {
      this.activeGroups.delete(job.data[this.groupBy] as string)
    }

    return super.onCompleted(job)
  }

  /**
   * Hook triggered when a job fails.
   * @param job - The job that was completed.
   * @param error - Error.
   */
  @OnWorkerEvent('failed')
  onFailed(job: GroupJob, error: Error) {
    if (this.groupBy in job.data && this.activeGroups.has(job.data[this.groupBy] as string)) {
      this.activeGroups.delete(job.data[this.groupBy] as string)
    }

    return super.onFailed(job, error)
  }
}
