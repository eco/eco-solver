import * as _ from 'lodash'
import { BulkJobOptions } from 'bullmq'
import { encodePacked, keccak256 } from 'viem'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { deserialize, serialize } from '@/common/utils/serialize'
import { IntentProcessorJobName } from '@/intent-processor/constants/job-names'
import { IntentProcessorInterface } from '@/intent-processor/types/processor.interface'
import {
  IntentProcessorJob,
  IntentProcessorJobManager,
  ExecuteSendBatchJobType as ExecuteSendBatchJob,
  ExecuteSendBatchJobData,
  ProveIntentData,
} from '@/intent-processor/types'

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

  async process(job: IntentProcessorJob, processor: IntentProcessorInterface): Promise<void> {
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
  onFailed(job: IntentProcessorJob, processor: IntentProcessorInterface, error: Error) {
    processor.logger.error(
      EcoLogMessage.fromDefault({
        message: `${ExecuteSendBatchJobManager.name}: Failed`,
        properties: { error: error instanceof Error ? error : new Error(String(error)) },
      }),
    )
  }
}
