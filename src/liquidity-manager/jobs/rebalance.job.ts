/* eslint-disable @typescript-eslint/no-unused-vars */
import { AutoInject } from '@/common/decorators/auto-inject.decorator'
import { deserialize, serialize, Serialize } from '@/common/utils/serialize'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { FlowChildJob, Job } from 'bullmq'
import {
  LiquidityManagerJob,
  LiquidityManagerJobManager,
} from '@/liquidity-manager/jobs/liquidity-manager.job'
import {
  LiquidityManagerJobName,
  LiquidityManagerQueueDataType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'
import { RebalanceRequest } from '@/liquidity-manager/types/types'

export interface RebalanceJobData extends LiquidityManagerQueueDataType {
  network: string
  walletAddress: string
  rebalance: Serialize<RebalanceRequest>
}

export type RebalanceJob = LiquidityManagerJob<LiquidityManagerJobName.REBALANCE, RebalanceJobData>

export class RebalanceJobManager extends LiquidityManagerJobManager<RebalanceJob> {
  static createJob(
    walletAddress: string,
    rebalance: RebalanceRequest,
    queueName: string,
  ): FlowChildJob {
    const firstQuote = rebalance.quotes?.[0]
    const data: RebalanceJobData = {
      groupID: firstQuote?.groupID ?? 'UnknownGroupID',
      rebalanceJobID: firstQuote?.rebalanceJobID ?? 'UnknownRebalanceJobID',
      walletAddress,
      network: rebalance.token.config.chainId.toString(),
      rebalance: serialize(rebalance),
    }
    return {
      queueName,
      data,
      name: LiquidityManagerJobName.REBALANCE,
    }
  }

  /**
   * Type guard to check if the given job is an instance of RebalanceJob.
   * @param job - The job to check.
   * @returns True if the job is a RebalanceJob.
   */
  is(job: LiquidityManagerJob): job is RebalanceJob {
    return job.name === LiquidityManagerJobName.REBALANCE
  }

  async process(job: LiquidityManagerJob, processor: LiquidityManagerProcessor): Promise<unknown> {
    if (this.is(job)) {
      return processor.liquidityManagerService.executeRebalancing(job.data)
    }
  }

  /**
   * Hook triggered when a job is completed.
   * Updates the corresponding rebalance records in DB to COMPLETED.
   * @param job - The job to process.
   * @param processor - The processor handling the job.
   */
  async onComplete(job: LiquidityManagerJob, processor: LiquidityManagerProcessor): Promise<void> {
    processor.logger.log(
      EcoLogMessage.withId({
        message: `RebalanceJobManager: LiquidityManagerJob: Completed!`,
        id: job.data.id,
        properties: {
          jobName: job.name,
          data: job.data,
        },
      }),
    )
  }

  /**
   * Handles job failures by logging the error.
   * @param job - The job that failed.
   * @param processor - The processor handling the job.
   * @param error - The error that occurred.
   */
  onFailed(job: LiquidityManagerJob, processor: LiquidityManagerProcessor, error: Error) {
    processor.logger.error(
      EcoLogMessage.withErrorAndId({
        id: job.data.id,
        message: `RebalanceJob: Failed`,
        error,
        properties: { data: job.data, jobName: job.name },
      }),
    )
  }
}
