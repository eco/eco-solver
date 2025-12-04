import { AutoInject } from '@/common/decorators/auto-inject.decorator'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { Hex } from 'viem'
import { LiFiStrategyContext, RebalanceQuote } from '@/liquidity-manager/types/types'
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
import { extractLiFiTxHash } from '@/liquidity-manager/services/liquidity-providers/LiFi/utils/get-transaction-hashes'

export interface CCIPLiFiDestinationSwapJobData extends LiquidityManagerQueueDataType {
  destinationChainId: number
  destinationSwapQuote: LiFiStrategyContext
  walletAddress: string
  originalTokenOut: {
    address: Hex
    chainId: number
    decimals: number
  }
  ccipTransactionHash?: Hex
}

export type CCIPLiFiDestinationSwapJob = LiquidityManagerJob<
  LiquidityManagerJobName.CCIP_LIFI_DESTINATION_SWAP,
  CCIPLiFiDestinationSwapJobData,
  { txHash: Hex; finalAmount: string }
>

export class CCIPLiFiDestinationSwapJobManager extends LiquidityManagerJobManager<CCIPLiFiDestinationSwapJob> {
  @AutoInject(RebalanceRepository)
  private rebalanceRepository: RebalanceRepository

  static async start(queue: Queue, data: CCIPLiFiDestinationSwapJobData, delay = 0): Promise<void> {
    await queue.add(LiquidityManagerJobName.CCIP_LIFI_DESTINATION_SWAP, data, {
      removeOnFail: false,
      delay,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2_000,
      },
    })
  }

  is(job: CCIPLiFiDestinationSwapJob): boolean {
    return job.name === LiquidityManagerJobName.CCIP_LIFI_DESTINATION_SWAP
  }

  async process(
    job: CCIPLiFiDestinationSwapJob,
    processor: LiquidityManagerProcessor,
  ): Promise<CCIPLiFiDestinationSwapJob['returnvalue']> {
    const { destinationChainId, destinationSwapQuote, walletAddress, id } = job.data

    processor.logger.debug(
      EcoLogMessage.withId({
        message: 'CCIPLiFiDestinationSwapJob: process start',
        id,
        properties: {
          destinationChainId,
          walletAddress,
          fromToken: destinationSwapQuote?.fromToken?.address,
          toToken: destinationSwapQuote?.toToken?.address,
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
          message: 'CCIPLiFi: DestinationSwapJob: Completed successfully',
          id,
          properties: { swapTxHash: result.txHash, finalAmount: result.finalAmount },
        }),
      )

      return result
    } catch (error) {
      processor.logger.error(
        EcoLogMessage.withErrorAndId({
          message: 'CCIPLiFi: DestinationSwapJob: Execution failed',
          id,
          error: error as any,
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
        message: 'CCIPLiFiDestinationSwapJob: executeDestinationSwap start',
        id: destinationSwapQuote.id,
        properties: { destinationChainId, walletAddress },
      }),
    )

    const quote: RebalanceQuote<'LiFi'> = {
      tokenIn: {
        chainId: destinationChainId,
        config: {
          address: destinationSwapQuote.fromToken.address as Hex,
          chainId: destinationChainId,
          minBalance: 0,
          targetBalance: 0,
          type: 'erc20',
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
          type: 'erc20',
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
      strategy: 'LiFi',
      context: destinationSwapQuote,
    }

    const execResult = await processor.liquidityManagerService.liquidityProviderManager.execute(
      walletAddress,
      quote,
    )

    const txHash = extractLiFiTxHash(execResult) ?? ('0x0' as Hex)

    if (txHash === '0x0') {
      processor.logger.warn(
        EcoLogMessage.withId({
          message: 'CCIPLiFiDestinationSwapJob: Could not extract tx hash from LiFi result',
          id: destinationSwapQuote.id,
          properties: { lifiResult: execResult },
        }),
      )
    }

    processor.logger.debug(
      EcoLogMessage.withId({
        message: 'CCIPLiFiDestinationSwapJob: executeDestinationSwap completed',
        id: destinationSwapQuote.id,
        properties: { execResult, txHash },
      }),
    )

    return {
      txHash,
      finalAmount: destinationSwapQuote.toAmount,
    }
  }

  async onComplete(
    job: CCIPLiFiDestinationSwapJob,
    processor: LiquidityManagerProcessor,
  ): Promise<void> {
    const jobData: LiquidityManagerQueueDataType = job.data as LiquidityManagerQueueDataType
    const { groupID, rebalanceJobID } = jobData

    processor.logger.log(
      EcoLogMessage.withId({
        message: 'CCIPLiFi: DestinationSwapJob: Completed',
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
    job: CCIPLiFiDestinationSwapJob,
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
          ? 'CCIPLiFi: DestinationSwapJob: FINAL FAILURE'
          : 'CCIPLiFi: DestinationSwapJob: Failed: Retrying...',
        id: job.data.id,
        error: error as any,
        properties: {
          data: job.data,
        },
      }),
    )
  }
}
