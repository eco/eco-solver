import * as _ from 'lodash'
import { BulkJobOptions, Job } from 'bullmq'
import { encodePacked, Hex, keccak256 } from 'viem'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { RewardInterface } from '@/indexer/interfaces/reward.interface'
import { deserialize, serialize, Serialize } from '@/common/utils/serialize'
import { WithdrawsJobName } from '@/withdraws/queues/withdraws.queue'
import { WithdrawsProcessor } from '@/withdraws/processors/withdraws.processor'
import { WithdrawsJob, WithdrawsJobManager } from '@/withdraws/jobs/withdraws.job'

export type ExecuteWithdrawsJobData = {
  chainId: number
  intentSourceAddr: Hex
  intents: {
    routeHash: Hex
    reward: RewardInterface
  }[]
}

type ExecuteWithdrawsJob = Job<
  Serialize<ExecuteWithdrawsJobData>,
  unknown,
  WithdrawsJobName.EXECUTE_WITHDRAWS
>

export class ExecuteWithdrawsJobManager extends WithdrawsJobManager<ExecuteWithdrawsJob> {
  static createJob(jobData: ExecuteWithdrawsJobData): {
    name: ExecuteWithdrawsJob['name']
    data: ExecuteWithdrawsJob['data']
    opts?: BulkJobOptions
  } {
    const intentHashes = _.map(jobData.intents, 'routeHash')
    const jobId = keccak256(encodePacked(['bytes32[]'], [intentHashes]))

    return {
      name: WithdrawsJobName.EXECUTE_WITHDRAWS,
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
  is(job: WithdrawsJob): job is ExecuteWithdrawsJob {
    return job.name === WithdrawsJobName.EXECUTE_WITHDRAWS
  }

  async process(job: WithdrawsJob, processor: WithdrawsProcessor): Promise<void> {
    if (this.is(job)) {
      return processor.withdrawsService.executeWithdrawals(deserialize(job.data))
    }
  }

  /**
   * Handles job failures by logging the error.
   * @param job - The job that failed.
   * @param processor - The processor handling the job.
   * @param error - The error that occurred.
   */
  onFailed(job: WithdrawsJob, processor: WithdrawsProcessor, error: Error) {
    processor.logger.error(
      EcoLogMessage.fromDefault({
        message: `ExecuteWithdrawsJob: Failed`,
        properties: { error: error.message },
      }),
    )
  }
}
