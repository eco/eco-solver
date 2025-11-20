import { Queue, UnrecoverableError } from 'bullmq'
import { LiquidityManagerJob, LiquidityManagerJobManager } from './liquidity-manager.job'
import {
  LiquidityManagerJobName,
  LiquidityManagerQueueDataType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { AutoInject } from '@/common/decorators/auto-inject.decorator'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'
import { Logger } from '@nestjs/common'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import {
  createClient as createCcipClient,
  TransferStatus,
} from '@/liquidity-manager/services/liquidity-providers/CCIP/ccip-client'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { Hex, PublicClient } from 'viem'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'
import { TRANSFER_STATUS_FROM_BLOCK_SHIFT } from '@/liquidity-manager/services/liquidity-providers/CCIP/ccip-abis'

export interface CheckCCIPDeliveryJobData extends LiquidityManagerQueueDataType {
  sourceChainId: number
  destinationChainId: number
  sourceChainSelector: string
  destinationChainSelector: string
  sourceRouter: Hex
  destinationRouter: Hex
  messageId: Hex
  txHash: Hex
  walletAddress: Hex
  pollCount?: number
  fromBlockNumber?: string
}

export type CheckCCIPDeliveryJob = LiquidityManagerJob<
  LiquidityManagerJobName.CHECK_CCIP_DELIVERY,
  CheckCCIPDeliveryJobData,
  { status: 'pending' | 'complete' }
>

export class CheckCCIPDeliveryJobManager extends LiquidityManagerJobManager<CheckCCIPDeliveryJob> {
  private logger = new Logger(CheckCCIPDeliveryJobManager.name)
  private readonly ccipClient = createCcipClient()

  @AutoInject(EcoConfigService)
  private ecoConfigService: EcoConfigService

  @AutoInject(MultichainPublicClientService)
  private publicClientService: MultichainPublicClientService

  @AutoInject(RebalanceRepository)
  private rebalanceRepository: RebalanceRepository

  static async start(queue: Queue, data: CheckCCIPDeliveryJobData): Promise<void> {
    await queue.add(LiquidityManagerJobName.CHECK_CCIP_DELIVERY, data, {
      removeOnFail: false,
      delay: 30_000,
      attempts: 10,
      backoff: { type: 'exponential', delay: 10_000 },
    })
  }

  is(job: LiquidityManagerJob): job is CheckCCIPDeliveryJob {
    return job.name === LiquidityManagerJobName.CHECK_CCIP_DELIVERY
  }

  async process(
    job: CheckCCIPDeliveryJob,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _processor: LiquidityManagerProcessor,
  ): Promise<CheckCCIPDeliveryJob['returnvalue']> {
    const { data } = job
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCIP: delivery check tick',
        id: data.id,
        properties: {
          messageId: data.messageId,
          sourceChainId: data.sourceChainId,
          destinationChainId: data.destinationChainId,
        },
      }),
    )

    const publicClient = await this.publicClientService.getClient(data.destinationChainId)
    const fromBlockNumber = await this.resolveFromBlockNumber(job, publicClient)
    const shouldPersistFromBlockNumber = !data.fromBlockNumber
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCIP: querying transfer status',
        id: data.id,
        properties: {
          messageId: data.messageId,
          destinationRouter: data.destinationRouter,
          fromBlockNumber: fromBlockNumber.toString(),
        },
      }),
    )
    const status = await this.ccipClient.getTransferStatus({
      client: publicClient,
      destinationRouterAddress: data.destinationRouter,
      sourceChainSelector: data.sourceChainSelector,
      messageId: data.messageId,
      fromBlockNumber,
      logger: (event, details) =>
        this.logger.debug(
          EcoLogMessage.withId({
            message: `CCIP client: ${event}`,
            id: data.id,
            properties: {
              messageId: data.messageId,
              ...details,
            },
          }),
        ),
    })
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCIP: transfer status response',
        id: data.id,
        properties: {
          messageId: data.messageId,
          status: status ?? 'null',
        },
      }),
    )

    if (status === TransferStatus.Success) {
      this.logger.log(
        EcoLogMessage.withId({
          message: 'CCIP: delivery confirmed',
          id: data.id,
          properties: { messageId: data.messageId },
        }),
      )
      return { status: 'complete' }
    }

    if (status === TransferStatus.Failure) {
      this.logger.error(
        EcoLogMessage.withId({
          message: 'CCIP: delivery failed permanently',
          id: data.id,
          properties: { messageId: data.messageId },
        }),
      )
      throw new UnrecoverableError('CCIP delivery failed')
    }

    const pollCount = this.getPollCount(job) + 1
    const maxAttempts = this.getMaxAttempts()

    const nextData: CheckCCIPDeliveryJobData = {
      ...job.data,
      pollCount,
    }
    if (shouldPersistFromBlockNumber) {
      nextData.fromBlockNumber = fromBlockNumber.toString()
    }
    await job.updateData(nextData)

    if (pollCount >= maxAttempts) {
      this.logger.error(
        EcoLogMessage.withId({
          message: 'CCIP: delivery polling exhausted',
          id: data.id,
          properties: { messageId: data.messageId, pollCount, maxAttempts },
        }),
      )
      throw new UnrecoverableError('CCIP delivery not confirmed within attempt budget')
    }

    await this.delay(job, this.getBackoffDelay())
    return { status: 'pending' }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async onComplete(job: CheckCCIPDeliveryJob, _p0: any): Promise<void> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCIP: delivery check complete',
        id: job.data.id,
        properties: { messageId: job.data.messageId },
      }),
    )
    if (job.returnvalue?.status === 'complete') {
      try {
        await this.rebalanceRepository.updateStatus(
          job.data.rebalanceJobID,
          RebalanceStatus.COMPLETED,
        )
      } catch (error) {
        this.logger.warn(
          EcoLogMessage.withErrorAndId({
            message: 'CCIP: failed to mark rebalance as completed',
            id: job.data.id,
            error: error as any,
          }),
        )
      }
    }
  }

  async onFailed(job: CheckCCIPDeliveryJob, _processor: LiquidityManagerProcessor, error: unknown) {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCIP: delivery check failed',
        id: job.data.id,
        properties: { messageId: job.data.messageId },
      }),
    )
    const finalAttempt = this.isFinalAttempt(job, error)
    if (finalAttempt) {
      try {
        await this.rebalanceRepository.updateStatus(job.data.rebalanceJobID, RebalanceStatus.FAILED)
      } catch (updateError) {
        this.logger.warn(
          EcoLogMessage.withErrorAndId({
            message: 'CCIP: failed to mark rebalance as failed',
            id: job.data.id,
            error: updateError as any,
          }),
        )
      }
    }
  }

  private getBackoffDelay() {
    return this.ecoConfigService.getCCIP().delivery.backoffMs
  }

  private getMaxAttempts() {
    return this.ecoConfigService.getCCIP().delivery.maxAttempts
  }

  private getPollCount(job: CheckCCIPDeliveryJob) {
    return job.data.pollCount ?? 0
  }

  private async resolveFromBlockNumber(job: CheckCCIPDeliveryJob, client: PublicClient) {
    if (job.data.fromBlockNumber) {
      return BigInt(job.data.fromBlockNumber)
    }
    const latestBlock = await client.getBlockNumber()
    return latestBlock > TRANSFER_STATUS_FROM_BLOCK_SHIFT
      ? latestBlock - TRANSFER_STATUS_FROM_BLOCK_SHIFT
      : 0n
  }
}
