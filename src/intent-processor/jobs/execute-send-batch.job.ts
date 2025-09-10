import * as _ from 'lodash'
import { BulkJobOptions, Job } from 'bullmq'
import { encodePacked, Hex, keccak256 } from 'viem'
import { deserialize, serialize, Serialize } from '@/common/utils/serialize'
import { IntentProcessorJobName } from '@/intent-processor/queues/intent-processor.queue'
import { IntentProcessor } from '@/intent-processor/processors/intent.processor'
import {
  IntentProcessorJob,
  IntentProcessorJobManager,
} from '@/intent-processor/jobs/intent-processor.job'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { GenericOperationLogger } from '@/common/logging/loggers'

export interface ProveIntentData {
  hash: Hex
  prover: Hex
  source: number
  intentSourceAddr: Hex
  inbox: Hex
}

export type ExecuteSendBatchJobData = {
  chainId: number
  intentSourceAddr: Hex
  inbox: Hex
  proves: ProveIntentData[]
}

export type ExecuteSendBatchJob = Job<
  Serialize<ExecuteSendBatchJobData>,
  unknown,
  IntentProcessorJobName.EXECUTE_SEND_BATCH
>

export class ExecuteSendBatchJobManager extends IntentProcessorJobManager<ExecuteSendBatchJob> {
  static createJob(jobData: ExecuteSendBatchJobData): {
    name: ExecuteSendBatchJob['name']
    data: ExecuteSendBatchJob['data']
    opts?: BulkJobOptions
  } {
    const intentHashes = _.map(jobData.proves, 'hash')
    const jobId = keccak256(encodePacked(['bytes32[]'], [intentHashes]))

    return {
      name: IntentProcessorJobName.EXECUTE_SEND_BATCH,
      data: serialize(jobData),
      opts: {
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }
  }

  /**
   * Type guard to check if the given job is an instance of ExecuteSendJob.
   * @param job - The job to check.
   * @returns True if the job is a ExecuteSendJob.
   */
  is(job: IntentProcessorJob): job is ExecuteSendBatchJob {
    return job.name === IntentProcessorJobName.EXECUTE_SEND_BATCH
  }

  @LogOperation('job_execution', GenericOperationLogger)
  async process(@LogContext job: IntentProcessorJob, processor: IntentProcessor): Promise<void> {
    if (this.is(job)) {
      return processor.intentProcessorService.executeSendBatch(deserialize(job.data))
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
