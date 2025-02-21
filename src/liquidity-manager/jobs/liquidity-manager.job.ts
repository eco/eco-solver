/* eslint @typescript-eslint/no-unused-vars: 0 */

import { Job } from 'bullmq'
import {
  LiquidityManagerQueueDataType,
  LiquidityManagerJobName,
} from '@/liquidity-manager/queues/liquidity-manager.queue'

export type LiquidityManagerJob<
  NameType extends LiquidityManagerJobName = LiquidityManagerJobName,
  DataType extends LiquidityManagerQueueDataType = LiquidityManagerQueueDataType,
  ReturnData = unknown,
> = Job<DataType, ReturnData, NameType>

export abstract class LiquidityManagerJobManager<
  Job extends LiquidityManagerJob = LiquidityManagerJob,
> {
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
  process(job: Job, processor: unknown): Promise<unknown> {
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
