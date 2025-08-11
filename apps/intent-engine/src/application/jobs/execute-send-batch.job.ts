import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { Hex } from 'viem'
import { IndexerService } from '@libs/domain'
import { EcoLogMessage } from '@libs/shared'
import {
  IntentProcessorJob,
  IntentProcessorJobManager,
} from './intent-processor.job'

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

  async process(job: IntentProcessorJob, processor: IntentProcessor): Promise<void> {
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
  onFailed(job: IntentProcessorJob, processor: IntentProcessor, error: Error) {
    processor.logger.error(
      EcoLogMessage.fromDefault({
        message: `${ExecuteSendBatchJobManager.name}: Failed`,
        properties: { error: error.message },
      }),
    )
  }
}
