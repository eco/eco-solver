import * as _ from 'lodash'
import { BulkJobOptions, Job } from 'bullmq'
import { encodePacked, Hex, keccak256 } from 'viem'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { RewardInterface } from '@/indexer/interfaces/reward.interface'
import { deserialize, serialize, Serialize } from '@/common/utils/serialize'
import { IntentProcessorJobName } from '@/intent-processor/queues/intent-processor.queue'
import { IntentProcessor } from '@/intent-processor/processors/intent.processor'
import {
  IntentProcessorJob,
  IntentProcessorJobManager,
} from '@/intent-processor/jobs/intent-processor.job'

export type ExecuteWithdrawsJobData = {
  chainId: number
  intentSourceAddr: Hex
  intents: {
    routeHash: Hex
    reward: RewardInterface
  }[]
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
    const intentHashes = _.map(jobData.intents, 'routeHash')
    const jobId = keccak256(encodePacked(['bytes32[]'], [intentHashes]))

    return {
      name: IntentProcessorJobName.EXECUTE_WITHDRAWS,
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
   * Type guard to check if the given job is an instance of ExecuteWithdrawsJob.
   * @param job - The job to check.
   * @returns True if the job is a ExecuteWithdrawsJob.
   */
  is(job: IntentProcessorJob): job is ExecuteWithdrawsJob {
    return job.name === IntentProcessorJobName.EXECUTE_WITHDRAWS
  }

  async process(job: IntentProcessorJob, processor: IntentProcessor): Promise<void> {
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
  onFailed(job: IntentProcessorJob, processor: IntentProcessor, error: Error) {
    processor.logger.error(
      EcoLogMessage.fromDefault({
        message: `ExecuteWithdrawsJob: Failed`,
        properties: { error: error.message },
      }),
    )
  }
}
