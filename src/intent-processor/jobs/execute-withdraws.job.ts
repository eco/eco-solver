import { BulkJobOptions, Job } from 'bullmq'
import { Hex } from 'viem'
import { deserialize, serialize, Serialize } from '@/common/utils/serialize'
import { IntentProcessorJobName } from '@/intent-processor/queues/intent-processor.queue'
import { IntentProcessor } from '@/intent-processor/processors/intent.processor'
import {
  IntentProcessorJob,
  IntentProcessorJobManager,
} from '@/intent-processor/jobs/intent-processor.job'
import { IntentType } from '@eco-foundation/routes-ts'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { GenericOperationLogger } from '@/common/logging/loggers'

export type ExecuteWithdrawsJobData = {
  chainId: number
  intentSourceAddr: Hex
  intents: IntentType[]
}

export type ExecuteWithdrawsJob = Job<
  Serialize<ExecuteWithdrawsJobData>,
  unknown,
  IntentProcessorJobName.EXECUTE_WITHDRAWS
>

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

  @LogOperation('job_execution', GenericOperationLogger)
  async process(@LogContext job: IntentProcessorJob, processor: IntentProcessor): Promise<void> {
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
  @LogOperation('job_execution', GenericOperationLogger)
  onFailed(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @LogContext job: IntentProcessorJob,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    processor: IntentProcessor,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @LogContext error: Error,
  ) {
    // Error details are automatically captured by the decorator
    // No need to re-throw the error as it's already been processed
  }
}
