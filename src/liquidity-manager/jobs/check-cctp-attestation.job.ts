import { AutoInject } from '@/common/decorators/auto-inject.decorator'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import {
  ExecuteCCTPMintJobData,
  ExecuteCCTPMintJobManager,
} from '@/liquidity-manager/jobs/execute-cctp-mint.job'
import { Hex } from 'viem'
import { LiFiStrategyContext } from '@/liquidity-manager/types/types'
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

// Enhanced job data to support CCTPLiFi operations
export interface CheckCCTPAttestationJobData extends LiquidityManagerQueueDataType {
  destinationChainId: number
  messageHash: Hex
  messageBody: Hex
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

export type CheckCCTPAttestationJob = LiquidityManagerJob<
  LiquidityManagerJobName.CHECK_CCTP_ATTESTATION,
  CheckCCTPAttestationJobData,
  { status: 'pending' } | { status: 'complete'; attestation: Hex }
>

export class CheckCCTPAttestationJobManager extends LiquidityManagerJobManager<CheckCCTPAttestationJob> {
  @AutoInject(RebalanceRepository)
  private rebalanceRepository: RebalanceRepository

  /**
   * Starts a job scheduler for checking CCTP attestation.
   *
   * @param {Queue} queue - The queue instance where the job will be added.
   * @param {CheckCCTPAttestationJobData} data - The data payload for the CheckCCTPAttestationJob.
   * @param {number} delay - Delay processing
   * @return {Promise<void>} A promise that resolves when the job scheduler is successfully added.
   */
  static async start(
    queue: Queue,
    data: CheckCCTPAttestationJobData,
    delay?: number,
  ): Promise<void> {
    await queue.add(LiquidityManagerJobName.CHECK_CCTP_ATTESTATION, data, {
      removeOnFail: false,
      delay: delay ?? 10_000,
      attempts: 10,
      backoff: {
        type: 'exponential',
        delay: 10_000,
      },
    })
  }

  /**
   * Type guard to check if the given job is an instance of CheckCCTPAttestationJob.
   * @param job - The job to check.
   * @returns True if the job is a CheckCCTPAttestationJob.
   */
  is(job: LiquidityManagerJob): job is CheckCCTPAttestationJob {
    return job.name === LiquidityManagerJobName.CHECK_CCTP_ATTESTATION
  }

  /**
   * Processes the given job by fetching the attestation using the provided processor.
   *
   * @param {CheckCCTPAttestationJob} job - The job containing data required for fetching the attestation.
   * @param {LiquidityManagerProcessor} processor - The processor used to handle the business logic and fetch the attestation.
   * @return {Promise<CheckCCTPAttestationJob['returnvalue']>} A promise that resolves with the result of the fetched attestation.
   */
  async process(
    job: CheckCCTPAttestationJob,
    processor: LiquidityManagerProcessor,
  ): Promise<CheckCCTPAttestationJob['returnvalue']> {
    const { messageHash, id, destinationChainId, cctpLiFiContext } = job.data
    const result = await processor.cctpProviderService.fetchAttestation(messageHash, id)

    if (result.status === 'pending') {
      processor.logger.debug(
        EcoLogMessage.withId({
          message: 'CCTP: CheckCCTPAttestationJob: Attestation pending...',
          id,
          properties: {
            ...result,
            messageHash,
            destinationChainId,
            isCCTPLiFi: !!cctpLiFiContext,
          },
        }),
      )

      await this.delay(job, 10_000)
    }

    return result
  }

  async onComplete(
    job: CheckCCTPAttestationJob,
    processor: LiquidityManagerProcessor,
  ): Promise<void> {
    if (job.returnvalue.status === 'complete') {
      processor.logger.debug(
        EcoLogMessage.withId({
          message:
            'CCTP: CheckCCTPAttestationJob: Attestation complete. Adding CCTP mint transaction to execution queue',
          id: job.data.id,
          properties: {
            groupID: job.data.groupID,
            rebalanceJobID: job.data.rebalanceJobID,
            returnvalue: job.returnvalue,
          },
        }),
      )

      const executeCCTPMintJobData: ExecuteCCTPMintJobData = {
        ...job.data,
        attestation: job.returnvalue.attestation,
        id: job.data.id,
      }

      await ExecuteCCTPMintJobManager.start(processor.queue, executeCCTPMintJobData)
    }
  }

  /**
   * Handles job failures by logging the error.
   * @param job - The job that failed.
   * @param processor - The processor handling the job.
   * @param error - The error that occurred.
   */
  async onFailed(
    job: CheckCCTPAttestationJob,
    processor: LiquidityManagerProcessor,
    error: unknown,
  ) {
    const isFinal = this.isFinalAttempt(job, error)

    const errorMessage = isFinal
      ? 'CCTP: CheckCCTPAttestationJob: FINAL FAILURE'
      : 'CCTP: CheckCCTPAttestationJob: Failed: Retrying...'

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
