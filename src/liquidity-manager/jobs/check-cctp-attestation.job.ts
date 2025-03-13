import { Queue } from 'bullmq'
import { Hex } from 'viem'
import {
  LiquidityManagerJob,
  LiquidityManagerJobManager,
} from '@/liquidity-manager/jobs/liquidity-manager.job'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { LiquidityManagerJobName } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'
import { ExecuteCCTPMintJobManager } from '@/liquidity-manager/jobs/execute-cctp-mint.job'

export type CheckCCTPAttestationJob = LiquidityManagerJob<
  LiquidityManagerJobName.CHECK_CCTP_ATTESTATION,
  { destinationChainId: number; messageHash: Hex; messageBody: Hex },
  { status: 'pending' } | { status: 'complete'; attestation: Hex }
>

export class CheckCCTPAttestationJobManager extends LiquidityManagerJobManager {
  /**
   * Starts a job scheduler for checking CCTP attestation.
   *
   * @param {Queue} queue - The queue instance where the job will be added.
   * @param {object} data - The data payload for the CheckCCTPAttestationJob.
   * @param {number} delay - Delay processing
   * @return {Promise<void>} A promise that resolves when the job scheduler is successfully added.
   */
  static async start(
    queue: Queue,
    data: CheckCCTPAttestationJob['data'],
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
   * @param {LiquidityManagerProcessor} processor - The processor used to handle the business logic and fetch the attestation.
   * @return {Promise<CheckCCTPAttestationJob['returnvalue']>} A promise that resolves with the result of the fetched attestation.
   */
  async process(
    job: CheckCCTPAttestationJob,
    processor: LiquidityManagerProcessor,
  ): Promise<CheckCCTPAttestationJob['returnvalue']> {
    const { messageHash } = job.data
    return processor.cctpProviderService.fetchAttestation(messageHash)
  }

  async onComplete(
    job: CheckCCTPAttestationJob,
    processor: LiquidityManagerProcessor,
  ): Promise<void> {
    if (job.returnvalue.status === 'complete') {
      processor.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'Adding CCTP mint transaction to execution queue',
          properties: job.returnvalue,
        }),
      )
      await ExecuteCCTPMintJobManager.start(processor.queue, {
        ...job.data,
        attestation: job.returnvalue.attestation,
      })
    } else {
      processor.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'Check CCTP attestation pending...',
          properties: {
            ...job.returnvalue,
            messageHash: job.data.messageHash,
            destinationChainId: job.data.destinationChainId,
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
  onFailed(job: CheckCCTPAttestationJob, processor: LiquidityManagerProcessor, error: unknown) {
    processor.logger.error(
      EcoLogMessage.fromDefault({
        message: `CheckCCTPAttestationJob: Failed`,
        properties: {
          error: (error as any)?.message ?? error,
          data: job.data,
        },
      }),
    )
  }
}
