/* eslint @typescript-eslint/no-unused-vars: 0 */
import { Job as BullMQJob, DelayedError, UnrecoverableError } from 'bullmq'

export abstract class BaseJobManager<Job extends BullMQJob, Processor = unknown> {
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
  abstract process(job: Job, processor: Processor): Promise<Job['returnvalue']>

  /**
   * Hook triggered when a job is completed.
   * @param job - The job to process.
   * @param processor - The processor handling the job.
   */
  onComplete(job: Job, processor: Processor): void {
    // Placeholder method implementation
  }

  /**
   * Hook triggered when a job fails.
   * @param job - The job to process.
   * @param processor - The processor handling the job.
   */
  onFailed(job: Job, processor: Processor, error: unknown): void {
    // Placeholder method implementation
  }

  /**
   * Checks if the job is a final attempt.
   * @param job - The job to check.
   * @param error - The error that occurred.
   * @returns A boolean indicating if the job is a final attempt.
   */
  isFinalAttempt(job: Job, error: unknown): boolean {
    if (error instanceof DelayedError) return false
    if (error instanceof UnrecoverableError) return true
    const attemptsAllowed = job.opts?.attempts ?? 1
    return job.attemptsMade >= attemptsAllowed
  }

  /** Delays the job by the given delay.
   * @param job - The job to delay.
   * @param delay - The delay in milliseconds.
   */
  async delay(job: Job, delay: number): Promise<void> {
    await job.moveToDelayed(Date.now() + delay, job.token)
    // we need to exit from the processor by throwing this error that will signal to the worker
    // that the job has been delayed so that it does not try to complete (or fail the job) instead
    throw new DelayedError()
  }
}
