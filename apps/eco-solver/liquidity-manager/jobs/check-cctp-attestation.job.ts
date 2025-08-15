import { Queue } from 'bullmq'
import { Hex } from 'viem'
import {
  LiquidityManagerJob,
  LiquidityManagerJobManager,
} from '@/liquidity-manager/jobs/liquidity-manager.job'
import { BaseLiquidityManagerJob, CheckCCTPAttestationJobData } from '@/liquidity-manager/types/job.types'
import { EcoLogMessage } from '@eco/infrastructure-logging'
import { LiquidityManagerJobName } from '@/liquidity-manager/constants/job-names'
import { LiquidityManagerProcessorInterface } from '@/liquidity-manager/types/processor.interface'
import { ExecuteCCTPMintJobManager } from '@/liquidity-manager/jobs/execute-cctp-mint.job'
import { LiFiStrategyContext } from '@/liquidity-manager/types/types'

export type CheckCCTPAttestationJob = BaseLiquidityManagerJob<
  LiquidityManagerJobName.CHECK_CCTP_ATTESTATION,
  CheckCCTPAttestationJobData,
  { status: 'pending' } | { status: 'complete'; attestation: Hex }
>

export class CheckCCTPAttestationJobManager extends LiquidityManagerJobManager<CheckCCTPAttestationJob> {
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
      removeOnComplete: true,
      delay,
      attempts: 3,
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
   * @param {LiquidityManagerProcessorInterface} processor - The processor used to handle the business logic and fetch the attestation.
   * @return {Promise<CheckCCTPAttestationJob['returnvalue']>} A promise that resolves with the result of the fetched attestation.
   */
  async process(
    job: CheckCCTPAttestationJob,
    processor: LiquidityManagerProcessorInterface,
  ): Promise<CheckCCTPAttestationJob['returnvalue']> {
    const { messageHash } = job.data
    return processor.cctpProviderService.fetchAttestation(messageHash)
  }

  async onComplete(
    job: CheckCCTPAttestationJob,
    processor: LiquidityManagerProcessorInterface,
  ): Promise<void> {
    if (job.returnvalue.status === 'complete') {
      processor.logger.debug(
        EcoLogMessage.withId({
          message:
            'CCTP: CheckCCTPAttestationJob: Attestation complete. Adding CCTP mint transaction to execution queue',
          id: job.data.id,
          properties: job.returnvalue,
        }),
      )

      await ExecuteCCTPMintJobManager.start(processor.queue, {
        ...job.data,
        attestation: job.returnvalue.attestation,
        id: job.data.id,
      })
    } else {
      processor.logger.debug(
        EcoLogMessage.withId({
          message: 'CCTP: CheckCCTPAttestationJob: Attestation pending...',
          id: job.data.id,
          properties: {
            ...job.returnvalue,
            messageHash: job.data.messageHash,
            destinationChainId: job.data.destinationChainId,
            isCCTPLiFi: !!job.data.cctpLiFiContext,
          },
        }),
      )

      await CheckCCTPAttestationJobManager.start(processor.queue, job.data, 30_000)
    }
  }

  /**
   * Handles job failures by logging the error.
   * @param job - The job that failed.
   * @param processor - The processor handling the job.
   * @param error - The error that occurred.
   */
  onFailed(job: CheckCCTPAttestationJob, processor: LiquidityManagerProcessorInterface, error: unknown) {
    processor.logger.error(
      EcoLogMessage.withId({
        message: `CCTP: CheckCCTPAttestationJob: Failed`,
        id: job.data.id,
        properties: {
          error: (error as any)?.message ?? error,
          data: job.data,
          isCCTPLiFi: !!job.data.cctpLiFiContext,
        },
      }),
    )
  }
}
