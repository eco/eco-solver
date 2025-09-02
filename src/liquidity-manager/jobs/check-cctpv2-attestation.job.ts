import { AutoInject } from '@/common/decorators/auto-inject.decorator'
import { CCTPV2StrategyContext } from '../types/types'
import { deserialize, Serialize } from '@/common/utils/serialize'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { ExecuteCCTPV2MintJobData, ExecuteCCTPV2MintJobManager } from './execute-cctpv2-mint.job'
import { Hex } from 'viem'
import {
  LiquidityManagerJob,
  LiquidityManagerJobManager,
} from '@/liquidity-manager/jobs/liquidity-manager.job'
import {
  LiquidityManagerJobName,
  LiquidityManagerQueueDataType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerProcessor } from '../processors/eco-protocol-intents.processor'
import { Queue } from 'bullmq'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'

export interface CheckCCTPV2AttestationJobData extends LiquidityManagerQueueDataType {
  sourceDomain: number
  destinationChainId: number
  transactionHash: Hex
  context: Serialize<CCTPV2StrategyContext>
}

export type CheckCCTPV2AttestationJob = LiquidityManagerJob<
  LiquidityManagerJobName.CHECK_CCTPV2_ATTESTATION,
  CheckCCTPV2AttestationJobData,
  // The V2 attestation API returns the message body and attestation together
  { status: 'pending' } | { status: 'complete'; messageBody: Hex; attestation: Hex }
>

export class CheckCCTPV2AttestationJobManager extends LiquidityManagerJobManager<CheckCCTPV2AttestationJob> {
  @AutoInject(RebalanceRepository)
  private rebalanceRepository: RebalanceRepository

  static async start(
    queue: Queue,
    data: CheckCCTPV2AttestationJobData,
    delay?: number,
  ): Promise<void> {
    try {
      await queue.add(LiquidityManagerJobName.CHECK_CCTPV2_ATTESTATION, data, {
        removeOnComplete: true,
        delay,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10_000,
        },
      })
    } catch (error) {
      throw error
    }
  }

  is(job: LiquidityManagerJob): job is CheckCCTPV2AttestationJob {
    return job.name === LiquidityManagerJobName.CHECK_CCTPV2_ATTESTATION
  }

  async process(
    job: CheckCCTPV2AttestationJob,
    processor: LiquidityManagerProcessor,
  ): Promise<CheckCCTPV2AttestationJob['returnvalue']> {
    const { transactionHash, sourceDomain } = job.data
    return processor.cctpv2ProviderService.fetchV2Attestation(
      transactionHash,
      sourceDomain,
      job.data.id,
    )
  }

  async onComplete(
    job: CheckCCTPV2AttestationJob,
    processor: LiquidityManagerProcessor,
  ): Promise<void> {
    const deserializedContext = deserialize(job.data.context)
    if (job.returnvalue.status === 'complete') {
      processor.logger.debug(
        EcoLogMessage.withId({
          message: 'CCTPV2: Attestation complete. Adding V2 mint transaction to execution queue',
          id: job.data.id,
          properties: job.returnvalue,
        }),
      )

      const executeCCTPV2MintJobData: ExecuteCCTPV2MintJobData = {
        groupID: job.data.groupID,
        rebalanceJobID: job.data.rebalanceJobID,
        destinationChainId: job.data.destinationChainId,
        context: job.data.context,
        id: job.data.id,
        messageBody: job.returnvalue.messageBody,
        attestation: job.returnvalue.attestation,
        messageHash: job.data.transactionHash,
      }

      await ExecuteCCTPV2MintJobManager.start(processor.queue, executeCCTPV2MintJobData)
    } else {
      processor.logger.debug(
        EcoLogMessage.withId({
          message: 'CCTPV2: Attestation pending...',
          id: job.data.id,
          properties: {
            ...job.returnvalue,
            transactionHash: job.data.transactionHash,
            destinationChainId: job.data.destinationChainId,
            transferType: deserializedContext.transferType,
          },
        }),
      )
      // Fast polling for "fast" transfers, slower for "standard"
      const delay = deserializedContext.transferType === 'fast' ? 3_000 : 30_000
      await CheckCCTPV2AttestationJobManager.start(processor.queue, job.data, delay)
    }
  }

  async onFailed(
    job: CheckCCTPV2AttestationJob,
    processor: LiquidityManagerProcessor,
    error: unknown,
  ) {
<<<<<<< HEAD
    const jobData: LiquidityManagerQueueDataType = job.data as LiquidityManagerQueueDataType
    const { groupID, rebalanceJobID } = jobData
=======
    const isFinal = this.isFinalAttempt(job, error)

    const errorMessage = isFinal
      ? 'CCTPV2: CheckCCTPV2AttestationJob: FINAL FAILURE'
      : 'CCTPV2: CheckCCTPV2AttestationJob: Failed: Retrying...'

    if (isFinal) {
      const jobData: LiquidityManagerQueueDataType = job.data as LiquidityManagerQueueDataType
      const { rebalanceJobID } = jobData
      await this.rebalanceRepository.updateStatus(rebalanceJobID, RebalanceStatus.FAILED)
    }
>>>>>>> ed00a4c9dbf61fd5fd6ed44f4db0231297eb2afc

    processor.logger.error(
      EcoLogMessage.withErrorAndId({
        message: errorMessage,
        id: job.data.id,
<<<<<<< HEAD
        properties: {
          groupID,
          rebalanceJobID,
          error: (error as any)?.message ?? error,
=======
        error: error as any,
        properties: {
>>>>>>> ed00a4c9dbf61fd5fd6ed44f4db0231297eb2afc
          data: job.data,
        },
      }),
    )

    if (this.isFinalAttempt(job, error)) {
      await this.rebalanceRepository.updateStatus(rebalanceJobID, RebalanceStatus.FAILED)
    }
  }
}
