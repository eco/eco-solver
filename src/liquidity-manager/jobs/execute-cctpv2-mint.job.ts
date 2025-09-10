import { AutoInject } from '@/common/decorators/auto-inject.decorator'
import { CCTPV2StrategyContext } from '../types/types'
import { deserialize, Serialize } from '@/common/utils/serialize'
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
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { GenericOperationLogger } from '@/common/logging/loggers'

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

  @LogOperation('job_execution', GenericOperationLogger)
  async process(
    @LogContext job: ExecuteCCTPV2MintJob,
    processor: LiquidityManagerProcessor,
  ): Promise<Hex> {
    const { destinationChainId, messageBody, attestation } = job.data
    processor.logger.debug({ operationType: 'job_execution' }, 'CCTPV2: Processing V2 mint job', {
      id: job.data.id,
      destinationChainId,
      messageLength: messageBody.length,
      attestationLength: attestation.length,
    })
    deserialize(job.data.context) // Deserialize for consistency, though not used here

    let txHash = job.data.txHash as Hex | undefined
    if (!txHash) {
      // receive message not called yet
      txHash = await processor.cctpv2ProviderService.receiveV2Message(
        destinationChainId,
        messageBody,
        attestation,
        job.data.id,
      )
      job.updateData({ ...job.data, txHash })
    }

    await processor.cctpv2ProviderService.getTxReceipt(destinationChainId, txHash as Hex)
    return txHash as Hex
  }

  @LogOperation('job_execution', GenericOperationLogger)
  async onComplete(@LogContext job: ExecuteCCTPV2MintJob, processor: LiquidityManagerProcessor) {
    const jobData: LiquidityManagerQueueDataType = job.data as LiquidityManagerQueueDataType
    const { groupID, rebalanceJobID } = jobData

    processor.logger.log(
      { operationType: 'job_execution', status: 'completed' },
      'CCTPV2: ExecuteCCTPV2MintJob: Completed!',
      {
        id: job.data.id,
        groupID,
        rebalanceJobID,
        chainId: job.data.destinationChainId,
        txHash: job.returnvalue,
      },
    )

    await this.rebalanceRepository.updateStatus(rebalanceJobID, RebalanceStatus.COMPLETED)
  }

  @LogOperation('job_execution', GenericOperationLogger)
  async onFailed(
    @LogContext job: ExecuteCCTPV2MintJob,
    processor: LiquidityManagerProcessor,
    @LogContext error: unknown,
  ) {
    const isFinal = this.isFinalAttempt(job, error)

    if (isFinal) {
      const jobData: LiquidityManagerQueueDataType = job.data as LiquidityManagerQueueDataType
      const { rebalanceJobID } = jobData
      await this.rebalanceRepository.updateStatus(rebalanceJobID, RebalanceStatus.FAILED)
    }

    // Error details are automatically captured by the decorator
    const errorObj = error instanceof Error ? error : new Error(String(error))
    throw errorObj
  }
}
