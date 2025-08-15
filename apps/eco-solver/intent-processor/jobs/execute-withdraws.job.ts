import { BulkJobOptions } from 'bullmq'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { deserialize, serialize } from '@/common/utils/serialize'
import { IntentProcessorJobName } from '@/intent-processor/constants/job-names'
import { IntentProcessorInterface } from '@/intent-processor/types/processor.interface'
import {
  IntentProcessorJob,
  IntentProcessorJobManager,
  ExecuteWithdrawsJobType as ExecuteWithdrawsJob,
  ExecuteWithdrawsJobData,
} from '@/intent-processor/types'

export class ExecuteWithdrawsJobManager extends IntentProcessorJobManager<ExecuteWithdrawsJob> {
  static createJob(jobData: ExecuteWithdrawsJobData): {
    name: ExecuteWithdrawsJob['name']
    data: ExecuteWithdrawsJob['data']
    opts?: BulkJobOptions
  } {
    return {
      name: IntentProcessorJobName.EXECUTE_WITHDRAWS,
      data: serialize(jobData),
      opts: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }
  }

  /**
   * Type guard to check if the given job is an instance of ExecuteWithdrawsJob.
   * @param job - The job to check.
   * @returns True if the job is a ExecuteWithdrawsJob.
   */
  is(job: IntentProcessorJob): job is ExecuteWithdrawsJob {
    return job.name === IntentProcessorJobName.EXECUTE_WITHDRAWS
  }

  async process(job: IntentProcessorJob, processor: IntentProcessorInterface): Promise<void> {
    if (this.is(job)) {
      return processor.intentProcessorService.executeWithdrawals(deserialize(job.data))
    }
  }

  /**
   * Handles job failures by logging the error.
   * @param job - The job that failed.
   * @param processor - The processor handling the job.
   * @param error - The error that occurred.
   */
  onFailed(job: IntentProcessorJob, processor: IntentProcessorInterface, error: Error) {
    processor.logger.error(
      EcoLogMessage.fromDefault({
        message: `ExecuteWithdrawsJob: Failed`,
        properties: { error: error instanceof Error ? error : new Error(String(error)) },
      }),
    )
  }
}
