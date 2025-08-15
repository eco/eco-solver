import { FlowChildJob, Job } from 'bullmq'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import {
  LiquidityManagerJob,
  LiquidityManagerJobManager,
} from '@/liquidity-manager/jobs/liquidity-manager.job'
import { LiquidityManagerJobName } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerProcessorInterface } from '@/liquidity-manager/types/processor.interface'
import { serialize, Serialize } from '@/common/utils/serialize'
import { RebalanceRequest } from '@/liquidity-manager/types/types'

export type RebalanceJobData = {
  network: string
  walletAddress: string
  rebalance: Serialize<RebalanceRequest>
}

type RebalanceJob = Job<RebalanceJobData, unknown, LiquidityManagerJobName.REBALANCE>

export class RebalanceJobManager extends LiquidityManagerJobManager<RebalanceJob> {
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

  async process(job: LiquidityManagerJob, processor: LiquidityManagerProcessorInterface): Promise<void> {
    if (this.is(job)) {
      return processor.liquidityManagerService.executeRebalancing(job.data)
    }
  }

  /**
   * Handles job failures by logging the error.
   * @param job - The job that failed.
   * @param processor - The processor handling the job.
   * @param error - The error that occurred.
   */
  onFailed(job: LiquidityManagerJob, processor: LiquidityManagerProcessorInterface, error: Error) {
    processor.logger.error(
      EcoLogMessage.fromDefault({
        message: `RebalanceJob: Failed`,
        properties: {
          error: error instanceof Error ? error : new Error(String(error)),
          stack: error.stack,
        },
      }),
    )
  }
}
