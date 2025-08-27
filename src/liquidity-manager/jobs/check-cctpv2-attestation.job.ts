import { Queue } from 'bullmq'
import { Hex } from 'viem'
import {
  LiquidityManagerJob,
  LiquidityManagerJobManager,
} from '@/liquidity-manager/jobs/liquidity-manager.job'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import {
  LiquidityManagerJobName,
  LiquidityManagerQueueDataType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { CCTPV2StrategyContext } from '../types/types'
import { LiquidityManagerProcessor } from '../processors/eco-protocol-intents.processor'
import { ExecuteCCTPV2MintJobManager } from './execute-cctpv2-mint.job'
import { deserialize, Serialize } from '@/common/utils/serialize'

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
      await ExecuteCCTPV2MintJobManager.start(processor.queue, {
        groupID: job.data.groupID,
        rebalanceJobID: job.data.rebalanceJobID,
        destinationChainId: job.data.destinationChainId,
        context: job.data.context,
        id: job.data.id,
        messageBody: job.returnvalue.messageBody,
        attestation: job.returnvalue.attestation,
        messageHash: job.data.transactionHash,
      })
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

  onFailed(job: CheckCCTPV2AttestationJob, processor: LiquidityManagerProcessor, error: unknown) {
    processor.logger.error(
      EcoLogMessage.withId({
        message: `CCTPV2: CheckCCTPV2AttestationJob Failed`,
        id: job.data.id,
        properties: { error: (error as any)?.message ?? error, data: job.data },
      }),
    )
  }
}
