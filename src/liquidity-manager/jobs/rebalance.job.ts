/* eslint-disable @typescript-eslint/no-unused-vars */
import { AutoInject } from '@/common/decorators/auto-inject.decorator'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { GenericOperationLogger } from '@/common/logging/loggers'
import { deserialize, serialize, Serialize } from '@/common/utils/serialize'
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
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceRequest } from '@/liquidity-manager/types/types'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'

export interface RebalanceJobData extends LiquidityManagerQueueDataType {
  network: string
  walletAddress: string
  rebalance: Serialize<RebalanceRequest>
}

export type RebalanceJob = LiquidityManagerJob<LiquidityManagerJobName.REBALANCE, RebalanceJobData>

export class RebalanceJobManager extends LiquidityManagerJobManager<RebalanceJob> {
  @AutoInject(RebalanceRepository)
  private rebalanceRepository: RebalanceRepository

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

  @LogOperation('job_execution', GenericOperationLogger)
  async process(
    @LogContext job: LiquidityManagerJob,
    processor: LiquidityManagerProcessor,
  ): Promise<void> {
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
  @LogOperation('job_execution', GenericOperationLogger)
  async onComplete(
    @LogContext job: LiquidityManagerJob,
    processor: LiquidityManagerProcessor,
  ): Promise<void> {
    const rebalanceData: RebalanceJobData = job.data as RebalanceJobData
  }

  /**
   * Handles job failures by logging the error.
   * @param job - The job that failed.
   * @param processor - The processor handling the job.
   * @param error - The error that occurred.
   */
  @LogOperation('job_execution', GenericOperationLogger)
  onFailed(
    @LogContext job: LiquidityManagerJob,
    processor: LiquidityManagerProcessor,
    @LogContext error: Error,
  ) {
    // Error details are automatically captured by the decorator
    throw error
  }
}
