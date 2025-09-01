import { AutoInject } from '@/common/decorators/auto-inject.decorator'
import { CCTPLiFiDestinationSwapJobData } from '@/liquidity-manager/jobs/cctp-lifi-destination-swap.job'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { Hex } from 'viem'
import { LiFiStrategyContext } from '../types/types'
import {
  LiquidityManagerJob,
  LiquidityManagerJobManager,
} from '@/liquidity-manager/jobs/liquidity-manager.job'
import {
  LiquidityManagerJobName,
  LiquidityManagerQueueDataType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'
import { Queue } from 'bullmq'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'

export interface ExecuteCCTPMintJobData extends LiquidityManagerQueueDataType {
  destinationChainId: number
  messageHash: Hex
  messageBody: Hex
  attestation: Hex
  // Optional CCTPLiFi context for destination swap operations
  cctpLiFiContext?: {
    destinationSwapQuote: LiFiStrategyContext
    walletAddress: string
    originalTokenOut: {
      address: Hex
      chainId: number
      decimals: number
    }
  }
}

export type ExecuteCCTPMintJob = LiquidityManagerJob<
  LiquidityManagerJobName.EXECUTE_CCTP_MINT,
  ExecuteCCTPMintJobData,
  Hex
>

export class ExecuteCCTPMintJobManager extends LiquidityManagerJobManager<ExecuteCCTPMintJob> {
  @AutoInject(RebalanceRepository)
  private rebalanceRepository: RebalanceRepository

  static async start(queue: Queue, data: ExecuteCCTPMintJob['data']): Promise<void> {
    await queue.add(LiquidityManagerJobName.EXECUTE_CCTP_MINT, data, {
      jobId: `${ExecuteCCTPMintJobManager.name}-${data.messageHash}`,
      removeOnComplete: false,
      removeOnFail: true,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 10_000,
      },
    })
  }

  /**
   * Type guard to check if the given job is an instance of ExecuteCCTPMintJob.
   * @param job - The job to check.
   * @returns True if the job is a ExecuteCCTPMintJob.
   */
  is(job: LiquidityManagerJob): job is ExecuteCCTPMintJob {
    return job.name === LiquidityManagerJobName.EXECUTE_CCTP_MINT
  }

  async process(job: ExecuteCCTPMintJob, processor: LiquidityManagerProcessor): Promise<Hex> {
    processor.logger.debug(
      EcoLogMessage.withId({
        message: `CCTP: ExecuteCCTPMintJob: Processing`,
        id: job.data.id,
        properties: { job },
      }),
    )

    const { destinationChainId, messageBody, attestation } = job.data
    return processor.cctpProviderService.receiveMessage(
      destinationChainId,
      messageBody,
      attestation,
      job.data.id,
    )
  }

  async onComplete(job: ExecuteCCTPMintJob, processor: LiquidityManagerProcessor) {
    const { groupID, rebalanceJobID, cctpLiFiContext } = job.data

    processor.logger.log(
      EcoLogMessage.withId({
        message: `CCTP: ExecuteCCTPMintJob: Completed!`,
        id: job.data.id,
        properties: {
          groupID,
          rebalanceJobID,
          chainId: job.data.destinationChainId,
          txHash: job.returnvalue,
          messageHash: job.data.messageHash,
        },
      }),
    )

    if (!(cctpLiFiContext && cctpLiFiContext.destinationSwapQuote)) {
      await this.rebalanceRepository.updateStatus(rebalanceJobID, RebalanceStatus.COMPLETED)
      return
    }

    processor.logger.debug(
      EcoLogMessage.withId({
        message: 'CCTP: ExecuteCCTPMintJob: Queuing CCTPLiFi destination swap',
        id: job.data.id,
        properties: {
          messageHash: job.data.messageHash,
          destinationChainId: job.data.destinationChainId,
          walletAddress: cctpLiFiContext.walletAddress,
        },
      }),
    )

    // Import dynamically to avoid circular dependency
    const { CCTPLiFiDestinationSwapJobManager } = await import('./cctp-lifi-destination-swap.job')

    const cctpLiFiDestinationSwapJobData: CCTPLiFiDestinationSwapJobData = {
      groupID: job.data.groupID,
      rebalanceJobID: job.data.rebalanceJobID,
      messageHash: job.data.messageHash,
      messageBody: job.data.messageBody,
      attestation: job.data.attestation,
      destinationChainId: job.data.destinationChainId,
      destinationSwapQuote: cctpLiFiContext.destinationSwapQuote,
      walletAddress: cctpLiFiContext.walletAddress,
      originalTokenOut: cctpLiFiContext.originalTokenOut,
      id: job.data.id,
    }

    await CCTPLiFiDestinationSwapJobManager.start(processor.queue, cctpLiFiDestinationSwapJobData)
  }

  /**
   * Handles job failures by logging the error.
   * @param job - The job that failed.
   * @param processor - The processor handling the job.
   * @param error - The error that occurred.
   */
  async onFailed(job: ExecuteCCTPMintJob, processor: LiquidityManagerProcessor, error: unknown) {
    const isFinal = this.isFinalAttempt(job, error)

    const errorMessage = isFinal
      ? 'CCTP: ExecuteCCTPMintJob: FINAL FAILURE'
      : 'CCTP: ExecuteCCTPMintJob: Failed: Retrying...'

    if (isFinal) {
      const jobData: LiquidityManagerQueueDataType = job.data as LiquidityManagerQueueDataType
      const { rebalanceJobID } = jobData
      await this.rebalanceRepository.updateStatus(rebalanceJobID, RebalanceStatus.FAILED)
    }

    processor.logger.error(
      EcoLogMessage.withErrorAndId({
        message: errorMessage,
        id: job.data.id,
        error: error as any,
        properties: {
          data: job.data,
        },
      }),
    )
  }
}
