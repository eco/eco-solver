/* eslint @typescript-eslint/no-unused-vars: 0 */
import { Job as BullMQJob } from 'bullmq'

export abstract class BaseJobManager<Job extends BullMQJob> {
  /**
   * Checks if the given job is of the specific type.
   * @param job - The job to check.
   * @returns A boolean indicating if the job is of the specific type.
   */
  abstract is(job: Job): boolean

  /**
   * Processes the given job.
   * @param job - The job to process.
   * @param processor - The processor handling the job.
   */
  abstract process(job: Job, processor: unknown): Promise<Job['returnvalue']>

  /**
   * Hook triggered when a job is completed.
   * @param job - The job to process.
   * @param processor - The processor handling the job.
   */
  onComplete(job: Job, processor: unknown): void {
    // Placeholder method implementation
  }

  /**
   * Hook triggered when a job fails.
   * @param job - The job to process.
   * @param processor - The processor handling the job.
   */
  onFailed(job: Job, processor: unknown, error: unknown): void {
    // Placeholder method implementation
  }
}
