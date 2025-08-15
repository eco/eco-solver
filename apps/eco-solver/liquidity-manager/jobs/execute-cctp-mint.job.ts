import { Queue } from 'bullmq'
import { Hex } from 'viem'
import {
  LiquidityManagerJob,
  LiquidityManagerJobManager,
  ExecuteCCTPMintJobType as ExecuteCCTPMintJob,
  ExecuteCCTPMintJobData,
} from '@/liquidity-manager/types'
import { EcoLogMessage } from '@eco/infrastructure-logging'
import { LiquidityManagerJobName } from '@/liquidity-manager/constants/job-names'
import { LiquidityManagerProcessorInterface } from '@/liquidity-manager/types/processor.interface'

// Type is now imported from shared types

export class ExecuteCCTPMintJobManager extends LiquidityManagerJobManager<ExecuteCCTPMintJob> {
  static async start(queue: Queue, data: ExecuteCCTPMintJobData): Promise<void> {
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

  async process(job: ExecuteCCTPMintJob, processor: LiquidityManagerProcessorInterface): Promise<Hex> {
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
    )
  }

  async onComplete(job: ExecuteCCTPMintJob, processor: LiquidityManagerProcessorInterface) {
    const { cctpLiFiContext } = job.data

    processor.logger.log(
      EcoLogMessage.withId({
        message: `CCTP: ExecuteCCTPMintJob: Completed!`,
        id: job.data.id,
        properties: {
          chainId: job.data.destinationChainId,
          txHash: job.returnvalue,
          messageHash: job.data.messageHash,
        },
      }),
    )

    if (cctpLiFiContext && cctpLiFiContext.destinationSwapQuote) {
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

      await CCTPLiFiDestinationSwapJobManager.start(processor.queue, {
        messageHash: job.data.messageHash,
        messageBody: job.data.messageBody,
        attestation: job.data.attestation,
        destinationChainId: job.data.destinationChainId,
        destinationSwapQuote: cctpLiFiContext.destinationSwapQuote,
        walletAddress: cctpLiFiContext.walletAddress,
        originalTokenOut: cctpLiFiContext.originalTokenOut,
        id: job.data.id,
      })
    }
  }

  /**
   * Handles job failures by logging the error.
   * @param job - The job that failed.
   * @param processor - The processor handling the job.
   * @param error - The error that occurred.
   */
  onFailed(job: ExecuteCCTPMintJob, processor: LiquidityManagerProcessorInterface, error: unknown) {
    processor.logger.error(
      EcoLogMessage.withId({
        message: `CCTP: ExecuteCCTPMintJob: Failed`,
        id: job.data.id,
        properties: { error: (error as any)?.message ?? error, data: job.data },
      }),
    )
  }
}
