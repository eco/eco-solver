/* eslint-disable @typescript-eslint/no-unused-vars */
import { AutoInject } from '@/common/decorators/auto-inject.decorator'
import { deserialize, serialize, Serialize } from '@/common/utils/serialize'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { FlowChildJob, Job } from 'bullmq'
import {
  LiquidityManagerJob,
  LiquidityManagerJobManager,
} from '@/liquidity-manager/jobs/liquidity-manager.job'
import { LiquidityManagerJobName } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceRequest } from '@/liquidity-manager/types/types'

export type RebalanceJobData = {
  network: string
  walletAddress: string
  rebalance: Serialize<RebalanceRequest>
}

type RebalanceJob = Job<RebalanceJobData, unknown, LiquidityManagerJobName.REBALANCE>

export class RebalanceJobManager extends LiquidityManagerJobManager<RebalanceJob> {
  @AutoInject(RebalanceRepository)
  private rebalanceRepository: RebalanceRepository

  static createJob(
    walletAddress: string,
    rebalance: RebalanceRequest,
    queueName: string,
  ): FlowChildJob {
    const data: RebalanceJobData = {
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

  async process(job: LiquidityManagerJob, processor: LiquidityManagerProcessor): Promise<void> {
    if (this.is(job)) {
      return processor.liquidityManagerService.executeRebalancing(job.data)
    }
  }

  /**
   * Hook triggered when a job is completed.
   * @param job - The job to process.
   * @param processor - The processor handling the job.
   */
  onComplete(job: LiquidityManagerJob, processor: LiquidityManagerProcessor): void {
    const rebalanceData: RebalanceJobData = job.data as RebalanceJobData

    const { network, walletAddress, rebalance } = rebalanceData
    for (const quote of rebalance.quotes) {
      const deserializedQuote = deserialize(quote)
    }

    processor.logger.log(
      EcoLogMessage.fromDefault({
        message: `RebalanceJobManager: LiquidityManagerJob: Completed!`,
        properties: {
          network,
          walletAddress,
          jobName: job.name,
          job,
          rebalanceRepository: this.rebalanceRepository.constructor.name,
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
      EcoLogMessage.fromDefault({
        message: `RebalanceJob: Failed`,
        properties: { error: error.message, stack: error.stack },
      }),
    )
  }
}
