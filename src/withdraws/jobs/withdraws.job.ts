/* eslint @typescript-eslint/no-unused-vars: 0 */

import { Job } from 'bullmq'
import { WithdrawsJobName, WithdrawsQueueDataType } from '@/withdraws/queues/withdraws.queue'

export type WithdrawsJob<
  NameType extends WithdrawsJobName = WithdrawsJobName,
  DataType extends WithdrawsQueueDataType = WithdrawsQueueDataType,
> = Job<DataType, unknown, NameType>

export abstract class WithdrawsJobManager<Job extends WithdrawsJob = WithdrawsJob> {
  /**
   * Checks if the given job is of the specific type.
   * @param job - The job to check.
   * @returns A boolean indicating if the job is of the specific type.
   */
  is(job: Job): boolean {
    throw new Error('Unimplemented function')
  }

  /**
   * Processes the given job.
   * @param job - The job to process.
   * @param processor - The processor handling the job.
   */
  process(job: Job, processor: unknown): Promise<void> {
    throw new Error('Unimplemented function')
  }

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
