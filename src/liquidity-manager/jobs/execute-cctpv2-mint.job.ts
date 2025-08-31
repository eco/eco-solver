import { AutoInject } from '@/common/decorators/auto-inject.decorator'
import { CCTPV2StrategyContext } from '../types/types'
import { deserialize, Serialize } from '@/common/utils/serialize'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
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

export interface ExecuteCCTPV2MintJobData extends LiquidityManagerQueueDataType {
  destinationChainId: number
  messageHash: Hex
  messageBody: Hex
  attestation: Hex
  context: Serialize<CCTPV2StrategyContext>
}

export type ExecuteCCTPV2MintJob = LiquidityManagerJob<
  LiquidityManagerJobName.EXECUTE_CCTPV2_MINT,
  ExecuteCCTPV2MintJobData,
  Hex
>

export class ExecuteCCTPV2MintJobManager extends LiquidityManagerJobManager<ExecuteCCTPV2MintJob> {
  @AutoInject(RebalanceRepository)
  private rebalanceRepository: RebalanceRepository

  static async start(queue: Queue, data: ExecuteCCTPV2MintJob['data']): Promise<void> {
    await queue.add(LiquidityManagerJobName.EXECUTE_CCTPV2_MINT, data, {
      jobId: `${ExecuteCCTPV2MintJobManager.name}-${data.messageHash}`,
      removeOnComplete: false,
      removeOnFail: true,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 10_000,
      },
    })
  }

  is(job: LiquidityManagerJob): job is ExecuteCCTPV2MintJob {
    return job.name === LiquidityManagerJobName.EXECUTE_CCTPV2_MINT
  }

  async process(job: ExecuteCCTPV2MintJob, processor: LiquidityManagerProcessor): Promise<Hex> {
    const { destinationChainId, messageBody, attestation } = job.data
    processor.logger.debug(
      EcoLogMessage.withId({
        message: 'CCTPV2: Processing V2 mint job',
        id: job.data.id,
        properties: {
          destinationChainId,
          messageLength: messageBody.length,
          attestationLength: attestation.length,
        },
      }),
    )
    deserialize(job.data.context) // Deserialize for consistency, though not used here
    return processor.cctpv2ProviderService.receiveV2Message(
      destinationChainId,
      messageBody,
      attestation,
      job.data.id,
    )
  }

  async onComplete(job: ExecuteCCTPV2MintJob, processor: LiquidityManagerProcessor) {
    const jobData: LiquidityManagerQueueDataType = job.data as LiquidityManagerQueueDataType
    const { groupID, rebalanceJobID } = jobData

    processor.logger.log(
      EcoLogMessage.withId({
        message: `CCTPV2: ExecuteCCTPV2MintJob: Completed!`,
        id: job.data.id,
        properties: {
          groupID,
          rebalanceJobID,
          chainId: job.data.destinationChainId,
          txHash: job.returnvalue,
          id: job.data.id,
        },
      }),
    )

    await this.rebalanceRepository.updateStatus(rebalanceJobID, RebalanceStatus.COMPLETED)
  }

  async onFailed(job: ExecuteCCTPV2MintJob, processor: LiquidityManagerProcessor, error: unknown) {
    let errorMessage = 'CCTPV2: ExecuteCCTPV2MintJob: Failed'
    if (this.isFinalAttempt(job, error)) {
      const jobData: LiquidityManagerQueueDataType = job.data as LiquidityManagerQueueDataType
      const { rebalanceJobID } = jobData
      await this.rebalanceRepository.updateStatus(rebalanceJobID, RebalanceStatus.FAILED)
    } else {
      errorMessage += ': Retrying...'
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
