import { Queue } from 'bullmq'
import { Hex } from 'viem'
import {
  LiquidityManagerJob,
  LiquidityManagerJobManager,
} from '@/liquidity-manager/jobs/liquidity-manager.job'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { LiquidityManagerJobName } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'

export type ExecuteCCTPMintJob = LiquidityManagerJob<
  LiquidityManagerJobName.EXECUTE_CCTP_MINT,
  { destinationChainId: number; messageHash: Hex; messageBody: Hex; attestation: Hex },
  Hex
>

export class ExecuteCCTPMintJobManager extends LiquidityManagerJobManager {
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
    const { destinationChainId, messageBody, attestation } = job.data
    return processor.cctpProviderService.receiveMessage(
      destinationChainId,
      messageBody,
      attestation,
    )
  }

  onComplete(job: ExecuteCCTPMintJob, processor: LiquidityManagerProcessor) {
    processor.logger.log(
      EcoLogMessage.fromDefault({
        message: `ExecuteCCTPMintJob: Completed!`,
        properties: {
          chainId: job.data.destinationChainId,
          txHash: job.returnvalue,
          messageHash: job.data.messageHash,
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
  onFailed(job: ExecuteCCTPMintJob, processor: LiquidityManagerProcessor, error: unknown) {
    processor.logger.error(
      EcoLogMessage.fromDefault({
        message: `ExecuteCCTPMintJob: Failed`,
        properties: {
          error: (error as any)?.message ?? error,
          data: job.data,
        },
      }),
    )
  }
}
