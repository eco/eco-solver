import { Queue } from 'bullmq'
import { Hex } from 'viem'
import {
  LiquidityManagerJob,
  LiquidityManagerJobManager,
} from '@/liquidity-manager/jobs/liquidity-manager.job'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { LiquidityManagerJobName } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'
import { LiFiStrategyContext, RebalanceQuote } from '@/liquidity-manager/types/types'

export interface CCTPLiFiDestinationSwapJobData {
  messageHash: Hex
  messageBody: Hex
  attestation: Hex
  destinationChainId: number
  destinationSwapQuote: LiFiStrategyContext
  walletAddress: string
  originalTokenOut: {
    address: Hex
    chainId: number
    decimals: number
  }
  cctpTransactionHash?: Hex
  retryCount?: number
  id?: string
  [key: string]: unknown // Index signature for BullMQ compatibility
}

export type CCTPLiFiDestinationSwapJob = LiquidityManagerJob<
  LiquidityManagerJobName.CCTP_LIFI_DESTINATION_SWAP,
  CCTPLiFiDestinationSwapJobData,
  { txHash: Hex; finalAmount: string }
>

export class CCTPLiFiDestinationSwapJobManager extends LiquidityManagerJobManager<CCTPLiFiDestinationSwapJob> {
  /**
   * Starts a job for executing the destination swap after CCTP attestation
   */
  static async start(queue: Queue, data: CCTPLiFiDestinationSwapJobData, delay = 0): Promise<void> {
    await queue.add(LiquidityManagerJobName.CCTP_LIFI_DESTINATION_SWAP, data, {
      removeOnComplete: true,
      removeOnFail: false, // Keep failed jobs for debugging - helps with stranded USDC recovery
      delay,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 15_000, // 15 seconds base delay
      },
    })
  }

  /**
   * Type guard to check if the given job is a CCTPLiFiDestinationSwapJob
   */
  is(job: CCTPLiFiDestinationSwapJob): boolean {
    return job.name === LiquidityManagerJobName.CCTP_LIFI_DESTINATION_SWAP
  }

  /**
   * Processes the destination swap job with enhanced error logging for recovery
   */
  async process(
    job: CCTPLiFiDestinationSwapJob,
    processor: LiquidityManagerProcessor,
  ): Promise<CCTPLiFiDestinationSwapJob['returnvalue']> {
    const { destinationChainId, destinationSwapQuote, walletAddress, originalTokenOut, id } =
      job.data

    processor.logger.debug(
      EcoLogMessage.withId({
        message: 'CCTPLiFi: CCTPLiFiDestinationSwapJob: Starting destination swap execution',
        id,
        properties: {
          destinationChainId,
          walletAddress,
          messageHash: job.data.messageHash,
          originalTokenOut,
          destinationSwapQuote,
        },
      }),
    )

    try {
      const swapResult = await this.executeDestinationSwap(
        processor,
        destinationSwapQuote,
        walletAddress,
        destinationChainId,
      )

      processor.logger.debug(
        EcoLogMessage.withId({
          message: 'CCTPLiFi: CCTPLiFiDestinationSwapJob: Destination swap completed successfully',
          id,
          properties: {
            swapTxHash: swapResult.txHash,
            finalAmount: swapResult.finalAmount,
            destinationChainId,
            originalTokenOut,
          },
        }),
      )

      return {
        txHash: swapResult.txHash,
        finalAmount: swapResult.finalAmount,
      }
    } catch (error) {
      // Enhanced error logging for stranded USDC detection (Priority 2)
      processor.logger.error(
        EcoLogMessage.withId({
          message: 'CCTPLiFi: STRANDED USDC ALERT - Destination swap failed',
          id,
          properties: {
            walletAddress,
            chainId: destinationChainId,
            originalTokenTarget: originalTokenOut.address,
            cctpTxHash: job.data.cctpTransactionHash,
            messageHash: job.data.messageHash,
            usdcAmount: destinationSwapQuote.fromAmount,
            error: error.message,
            timestamp: new Date().toISOString(),
            retryCount: job.data.retryCount || 0,
            attemptsMade: job.attemptsMade,
            maxAttempts: job.opts?.attempts || 1,
          },
        }),
      )

      processor.logger.error(
        EcoLogMessage.withErrorAndId({
          error,
          message: 'CCTPLiFi: Destination swap execution failed',
          id,
          properties: {
            destinationChainId,
            walletAddress,
            messageHash: job.data.messageHash,
          },
        }),
      )
      throw error
      // Note: BullMQ will automatically retry based on job configuration
      // Failed jobs with "STRANDED USDC ALERT" marker should be monitored for manual intervention
    }
  }

  /**
   * Executes the LiFi swap on the destination chain
   */
  private async executeDestinationSwap(
    processor: LiquidityManagerProcessor,
    destinationSwapQuote: LiFiStrategyContext,
    walletAddress: string,
    destinationChainId: number,
  ): Promise<{ txHash: Hex; finalAmount: string }> {
    processor.logger.debug(
      EcoLogMessage.withId({
        message: 'CCTPLiFi: CCTPLiFiDestinationSwapJob: Executing destination swap',
        id: destinationSwapQuote.id,
        properties: { destinationSwapQuote, walletAddress, destinationChainId },
      }),
    )

    // Create a temporary quote object for LiFi execution
    const tempQuote : RebalanceQuote = {
      tokenIn: {
        chainId: destinationChainId,
        config: {
          address: destinationSwapQuote.fromToken.address as Hex,
          chainId: destinationChainId,
          minBalance: 0n,
          targetBalance: 0n,
          type: 'erc20' as const,
        },
        balance: {
          address: destinationSwapQuote.fromToken.address as Hex,
          decimals: destinationSwapQuote.fromToken.decimals,
          balance: 1000000000000000000n, // TODO: get balance from balance service
        },
      },
      tokenOut: {
        chainId: destinationChainId,
        config: {
          address: destinationSwapQuote.toToken.address as Hex,
          chainId: destinationChainId,
          minBalance: 0n,
          targetBalance: 0n,
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

    // Execute the swap through the liquidity provider service
    const result = await processor.liquidityManagerService.liquidityProviderService.execute(
      walletAddress,
      tempQuote,
    )

    processor.logger.debug(
      EcoLogMessage.withId({
        message: 'CCTPLiFi: CCTPLiFiDestinationSwapJob: Destination swap completed',
        id: destinationSwapQuote.id,
        properties: { walletAddress, tempQuote, result },
      }),
    )

    // TODO: Extract actual transaction hash from LiFi result
    // Current limitation: liquidityProviderManager.execute() doesn't return the execution result
    // This placeholder is acceptable because:
    // 1. The swap still executes successfully without the hash
    // 2. We have comprehensive error logging for failed swaps ("STRANDED USDC ALERT")
    // 3. The main flow tracking uses the CCTP transaction hash
    //
    // To implement: Modify liquidityProviderManager.execute() to return the LiFi result,
    // then use the extractTransactionHashFromLiFiResult() logic from cctp-lifi-provider.service.ts
    return {
      txHash: '0x0' as Hex, // Placeholder - see TODO above
      finalAmount: destinationSwapQuote.toAmount,
    }
  }

  /**
   * Handles successful job completion with enhanced logging
   */
  async onComplete(
    job: CCTPLiFiDestinationSwapJob,
    processor: LiquidityManagerProcessor,
  ): Promise<void> {
    processor.logger.log(
      EcoLogMessage.withId({
        message: 'CCTPLiFi: CCTPLiFiDestinationSwapJob: Destination swap completed successfully',
        id: job.data.id,
        properties: {
          jobId: job.data.id,
          txHash: job.returnvalue?.txHash,
          finalAmount: job.returnvalue?.finalAmount,
          destinationChainId: job.data.destinationChainId,
          walletAddress: job.data.walletAddress,
        },
      }),
    )
  }

  /**
   * Handles job failures with detailed error logging for recovery purposes
   */
  onFailed(job: CCTPLiFiDestinationSwapJob, processor: LiquidityManagerProcessor, error: unknown) {
    processor.logger.error(
      EcoLogMessage.withId({
        message:
          'CCTPLiFi: CCTPLiFiDestinationSwapJob: FINAL FAILURE - Manual intervention required for stranded USDC',
        id: job.data.id,
        properties: {
          jobId: job.data.id,
          error: (error as any)?.message ?? error,
          walletAddress: job.data.walletAddress,
          chainId: job.data.destinationChainId,
          originalTokenTarget: job.data.originalTokenOut.address,
          usdcAmount: job.data.destinationSwapQuote.fromAmount,
          attemptsMade: job.attemptsMade,
          maxAttempts: job.opts?.attempts || 1,
          timestamp: new Date().toISOString(),
        },
      }),
    )
    // This error log can be monitored for alerting systems to detect stranded USDC
  }
}
