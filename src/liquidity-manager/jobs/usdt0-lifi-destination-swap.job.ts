import { AutoInject } from '@/common/decorators/auto-inject.decorator'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
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

export interface USDT0LiFiDestinationSwapJobData extends LiquidityManagerQueueDataType {
  destinationChainId: number
  destinationSwapQuote: LiFiStrategyContext
  walletAddress: string
  originalTokenOut: {
    address: Hex
    chainId: number
    decimals: number
  }
  usdt0TransactionHash?: Hex
}

export type USDT0LiFiDestinationSwapJob = LiquidityManagerJob<
  LiquidityManagerJobName.USDT0_LIFI_DESTINATION_SWAP,
  USDT0LiFiDestinationSwapJobData,
  { txHash: Hex; finalAmount: string }
>

export class USDT0LiFiDestinationSwapJobManager extends LiquidityManagerJobManager<USDT0LiFiDestinationSwapJob> {
  @AutoInject(RebalanceRepository)
  private rebalanceRepository: RebalanceRepository

  static async start(
    queue: Queue,
    data: USDT0LiFiDestinationSwapJobData,
    delay = 0,
  ): Promise<void> {
    await queue.add(LiquidityManagerJobName.USDT0_LIFI_DESTINATION_SWAP, data, {
      removeOnFail: false,
      delay,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2_000,
      },
    })
  }

  is(job: USDT0LiFiDestinationSwapJob): boolean {
    return job.name === LiquidityManagerJobName.USDT0_LIFI_DESTINATION_SWAP
  }

  async process(
    job: USDT0LiFiDestinationSwapJob,
    processor: LiquidityManagerProcessor,
  ): Promise<USDT0LiFiDestinationSwapJob['returnvalue']> {
    const { destinationChainId, destinationSwapQuote, walletAddress, originalTokenOut, id } =
      job.data

    processor.logger.debug(
      EcoLogMessage.withId({
        message: 'USDT0LiFi: DestinationSwapJob: Starting execution',
        id,
        properties: {
          destinationChainId,
          walletAddress,
          originalTokenOut,
          destinationSwapQuote,
        },
      }),
    )

    try {
      const result = await this.executeDestinationSwap(
        processor,
        destinationSwapQuote,
        walletAddress,
        destinationChainId,
      )

      processor.logger.debug(
        EcoLogMessage.withId({
          message: 'USDT0LiFi: DestinationSwapJob: Completed successfully',
          id,
          properties: { swapTxHash: result.txHash, finalAmount: result.finalAmount },
        }),
      )

      return result
    } catch (error) {
      processor.logger.error(
        EcoLogMessage.withErrorAndId({
          error,
          message: 'USDT0LiFi: DestinationSwapJob: Execution failed',
          id,
          properties: {
            destinationChainId,
            walletAddress,
          },
        }),
      )
      throw error
    }
  }

  private async executeDestinationSwap(
    processor: LiquidityManagerProcessor,
    destinationSwapQuote: LiFiStrategyContext,
    walletAddress: string,
    destinationChainId: number,
  ): Promise<{ txHash: Hex; finalAmount: string }> {
    processor.logger.debug(
      EcoLogMessage.withId({
        message: 'USDT0LiFi: DestinationSwapJob: Executing destination swap',
        id: destinationSwapQuote.id,
        properties: { destinationSwapQuote, walletAddress, destinationChainId },
      }),
    )

    const tempQuote = {
      tokenIn: {
        chainId: destinationChainId,
        config: {
          address: destinationSwapQuote.fromToken.address as Hex,
          chainId: destinationChainId,
          minBalance: 0,
          targetBalance: 0,
          type: 'erc20' as const,
        },
        balance: {
          address: destinationSwapQuote.fromToken.address as Hex,
          decimals: destinationSwapQuote.fromToken.decimals,
          balance: 1000000000000000000n,
        },
      },
      tokenOut: {
        chainId: destinationChainId,
        config: {
          address: destinationSwapQuote.toToken.address as Hex,
          chainId: destinationChainId,
          minBalance: 0,
          targetBalance: 0,
          type: 'erc20' as const,
        },
        balance: {
          address: destinationSwapQuote.toToken.address as Hex,
          decimals: destinationSwapQuote.toToken.decimals,
          balance: 0n,
        },
      },
      amountIn: BigInt(destinationSwapQuote.fromAmount),
      amountOut: BigInt(destinationSwapQuote.toAmount),
      slippage:
        1 -
        parseFloat(destinationSwapQuote.toAmountMin) / parseFloat(destinationSwapQuote.fromAmount),
      strategy: 'LiFi' as const,
      context: destinationSwapQuote,
    }

    await processor.liquidityManagerService.liquidityProviderManager.execute(
      walletAddress,
      tempQuote as any,
    )

    return {
      txHash: '0x0' as Hex,
      finalAmount: destinationSwapQuote.toAmount,
    }
  }

  async onComplete(
    job: USDT0LiFiDestinationSwapJob,
    processor: LiquidityManagerProcessor,
  ): Promise<void> {
    const jobData: LiquidityManagerQueueDataType = job.data as LiquidityManagerQueueDataType
    const { groupID, rebalanceJobID } = jobData

    processor.logger.log(
      EcoLogMessage.withId({
        message: 'USDT0LiFi: DestinationSwapJob: Completed',
        id: job.data.id,
        properties: {
          groupID,
          rebalanceJobID,
          txHash: job.returnvalue?.txHash,
          finalAmount: job.returnvalue?.finalAmount,
          destinationChainId: job.data.destinationChainId,
          walletAddress: job.data.walletAddress,
        },
      }),
    )

    await this.rebalanceRepository.updateStatus(rebalanceJobID, RebalanceStatus.COMPLETED)
  }

  async onFailed(
    job: USDT0LiFiDestinationSwapJob,
    processor: LiquidityManagerProcessor,
    error: unknown,
  ) {
    const isFinal = this.isFinalAttempt(job, error)

    if (isFinal) {
      const jobData: LiquidityManagerQueueDataType = job.data as LiquidityManagerQueueDataType
      const { rebalanceJobID } = jobData
      await this.rebalanceRepository.updateStatus(rebalanceJobID, RebalanceStatus.FAILED)
    }

    processor.logger.error(
      EcoLogMessage.withErrorAndId({
        message: isFinal
          ? 'USDT0LiFi: DestinationSwapJob: FINAL FAILURE'
          : 'USDT0LiFi: DestinationSwapJob: Failed: Retrying...',
        id: job.data.id,
        error: error as any,
        properties: {
          data: job.data,
        },
      }),
    )
  }
}
