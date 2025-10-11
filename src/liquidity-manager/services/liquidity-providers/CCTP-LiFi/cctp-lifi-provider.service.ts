import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { parseUnits, Hex, formatUnits } from 'viem'
import { LiquidityManagerLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { BalanceService } from '@/balance/balance.service'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import {
  RebalanceQuote,
  TokenData,
  CCTPLiFiStrategyContext,
  LiFiStrategyContext,
} from '@/liquidity-manager/types/types'
import {
  LiquidityManagerQueue,
  LiquidityManagerQueueType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LIQUIDITY_MANAGER_QUEUE_NAME } from '@/liquidity-manager/constants/queue.constants'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { CCTPProviderService } from '@/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service'
import { CCTPLiFiRoutePlanner, RouteStep } from './utils/route-planner'
import * as SlippageCalculator from './utils/slippage-calculator'
import { CCTPLiFiValidator } from './utils/validation'
import { CCTPLiFiConfig } from '@/eco-configs/eco-config.types'
import { EcoAnalyticsService } from '@/analytics/eco-analytics.service'
import { ANALYTICS_EVENTS } from '@/analytics/events.constants'
import { CheckCCTPAttestationJobData } from '@/liquidity-manager/jobs/check-cctp-attestation.job'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'

@Injectable()
export class CCTPLiFiProviderService implements IRebalanceProvider<'CCTPLiFi'> {
  private logger = new LiquidityManagerLogger('CCTPLiFiProviderService')
  private liquidityManagerQueue: LiquidityManagerQueue
  private config: CCTPLiFiConfig

  constructor(
    private readonly liFiService: LiFiProviderService,
    private readonly cctpService: CCTPProviderService,
    private readonly ecoConfigService: EcoConfigService,
    private readonly balanceService: BalanceService,
    @InjectQueue(LIQUIDITY_MANAGER_QUEUE_NAME)
    private readonly queue: LiquidityManagerQueueType,
    private readonly ecoAnalytics: EcoAnalyticsService,
    private readonly rebalanceRepository: RebalanceRepository,
  ) {
    this.liquidityManagerQueue = new LiquidityManagerQueue(queue)
    this.config = this.ecoConfigService.getCCTPLiFiConfig()

    // Initialize CCTPLiFiRoutePlanner with config values
    CCTPLiFiRoutePlanner.updateUSDCAddresses(this.config.usdcAddresses)
  }

  getStrategy() {
    return 'CCTPLiFi' as const
  }

  @LogOperation('provider_quote_generation', LiquidityManagerLogger)
  async getQuote(
    @LogContext tokenIn: TokenData,
    @LogContext tokenOut: TokenData,
    @LogContext swapAmount: number,
    @LogContext id?: string,
  ): Promise<RebalanceQuote<'CCTPLiFi'>> {
    // Business event logging handled by @LogOperation decorator

    // 1. Enhanced pre-checks: CCTP compatibility and validation
    const validation = CCTPLiFiValidator.validateRoute(
      tokenIn,
      tokenOut,
      swapAmount,
      this.config.maxSlippage,
    )

    if (!validation.isValid) {
      const errorMessage = `Invalid CCTPLiFi route: ${validation.errors.join(', ')}`
      this.logger.logProviderDomainValidation(
        'CCTPLiFi',
        `${tokenIn.chainId}-${tokenOut.chainId}`,
        false,
      )
      throw new Error(errorMessage)
    }

    // Validation warnings are now handled by decorators and domain validation logging

    // 2. Plan route steps
    const steps = CCTPLiFiRoutePlanner.planRoute(tokenIn, tokenOut)
    // Route planning logged by decorator context

    // 3. Get quotes for each step and build context
    const context = await this.buildRouteContext(tokenIn, tokenOut, swapAmount, steps, id)

    // 4. Calculate total amounts and slippage
    const { totalAmountOut, totalSlippage } = this.calculateTotals(context, swapAmount)

    // 5. Final validation of calculated slippage
    if (totalSlippage > this.config.maxSlippage) {
      // High slippage warnings are captured by decorator context
    }

    const quote: RebalanceQuote<'CCTPLiFi'> = {
      amountIn: parseUnits(swapAmount.toString(), tokenIn.balance.decimals),
      amountOut: totalAmountOut,
      slippage: totalSlippage,
      tokenIn,
      tokenOut,
      strategy: this.getStrategy(),
      context,
      id,
    }

    // Log successful quote generation as business event
    this.logger.logProviderQuoteGeneration(
      'CCTPLiFi',
      {
        sourceChainId: tokenIn.chainId,
        destinationChainId: tokenOut.chainId,
        amount: swapAmount,
        tokenIn: tokenIn.config.address,
        tokenOut: tokenOut.config.address,
        slippage: totalSlippage,
      },
      true,
    )

    return quote
  }

  @LogOperation('provider_execution', LiquidityManagerLogger)
  async execute(
    @LogContext walletAddress: string,
    @LogContext quote: RebalanceQuote<'CCTPLiFi'>,
  ): Promise<unknown> {
    const { steps, sourceSwapQuote, destinationSwapQuote } = quote.context

    // Execution start logged by @LogOperation decorator
    this.logger.logProviderExecution('CCTPLiFi', walletAddress, quote)

    try {
      // Step 1: Source chain swap (if needed)
      if (steps.includes('sourceSwap') && sourceSwapQuote) {
        await this.executeSourceSwap(walletAddress, sourceSwapQuote)
        // Source swap completion logged by decorator context
      }

      // Step 2: CCTP bridge
      const cctpResult = await this.executeCCTPBridge(walletAddress, quote)
      // CCTP bridge initiation logged by decorator context

      // Step 3: Always queue CCTP attestation check since CCTP is async
      const checkCCTPAttestationJobData: CheckCCTPAttestationJobData = {
        destinationChainId: quote.tokenOut.chainId,
        messageHash: cctpResult.messageHash,
        messageBody: cctpResult.messageBody,
        groupID: quote.groupID!,
        rebalanceJobID: quote.rebalanceJobID!,

        // Add CCTPLiFi context if destination swap is needed
        cctpLiFiContext:
          steps.includes('destinationSwap') && destinationSwapQuote
            ? {
                destinationSwapQuote,
                walletAddress,
                originalTokenOut: {
                  address: destinationSwapQuote.toAddress as Hex,
                  chainId: quote.tokenOut.chainId,
                  decimals: quote.tokenOut.balance.decimals,
                },
              }
            : undefined,
        id: quote.id,
      }

      await this.liquidityManagerQueue.startCCTPAttestationCheck(checkCCTPAttestationJobData)
      // CCTP attestation queueing logged by decorator context

      // Step 4: Log destination swap status
      if (steps.includes('destinationSwap') && destinationSwapQuote) {
        // Destination swap status logged by decorator context
      } else {
        // Execution completion status logged by decorator context
      }

      return cctpResult.txHash
    } catch (error) {
      this.ecoAnalytics.trackError(
        ANALYTICS_EVENTS.LIQUIDITY_MANAGER.CCTP_LIFI_EXECUTION_ERROR,
        error,
        {
          id: quote.id,
          walletAddress,
          sourceChain: quote.tokenIn.chainId,
          destinationChain: quote.tokenOut.chainId,
          amountIn: quote.amountIn.toString(),
          amountOut: quote.amountOut.toString(),
          steps: quote.context.steps,
          operation: 'cctp_lifi_execution',
          service: this.constructor.name,
        },
      )

      // Error logging handled by @LogOperation decorator
      try {
        if (quote.rebalanceJobID) {
          await this.rebalanceRepository.updateStatus(quote.rebalanceJobID, RebalanceStatus.FAILED)
        }
      } catch {}
      throw error
    }
  }

  /**
   * Builds the route context by getting quotes for each required step
   */
  private async buildRouteContext(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    steps: RouteStep[],
    id?: string,
  ): Promise<CCTPLiFiStrategyContext> {
    let sourceSwapQuote: LiFiStrategyContext | undefined
    let destinationSwapQuote: LiFiStrategyContext | undefined
    let cctpAmount = swapAmount

    try {
      // Get source swap quote if needed
      if (steps.some((step) => step.type === 'sourceSwap')) {
        const usdcTokenData = this.createUSDCTokenData(tokenIn.chainId)
        const sourceQuote = await this.liFiService.getQuote(tokenIn, usdcTokenData, swapAmount, id)
        sourceSwapQuote = sourceQuote.context
        cctpAmount = Number(formatUnits(BigInt(sourceSwapQuote.toAmount), 6))

        // Source swap quote logged by parent operation context
      }

      // Get destination swap quote if needed
      if (steps.some((step) => step.type === 'destinationSwap')) {
        const usdcTokenData = this.createUSDCTokenData(tokenOut.chainId)
        const destQuote = await this.liFiService.getQuote(usdcTokenData, tokenOut, cctpAmount, id)
        destinationSwapQuote = destQuote.context

        // Destination swap quote logged by parent operation context
      }
    } catch (error) {
      this.ecoAnalytics.trackError(
        ANALYTICS_EVENTS.LIQUIDITY_MANAGER.CCTP_LIFI_ROUTE_CONTEXT_ERROR,
        error,
        {
          id,
          tokenIn: {
            address: tokenIn.config.address,
            chainId: tokenIn.chainId,
          },
          tokenOut: {
            address: tokenOut.config.address,
            chainId: tokenOut.chainId,
          },
          swapAmount,
          steps: steps.map((step) => step.type),
          operation: 'build_route_context',
          service: this.constructor.name,
        },
      )

      // Build route context errors logged by parent decorator
      throw new Error(`Failed to build route context: ${error.message}`)
    }

    // Calculate gas estimation for the route
    const hasSourceSwap = steps.some((step) => step.type === 'sourceSwap')
    const hasDestinationSwap = steps.some((step) => step.type === 'destinationSwap')
    const gasEstimation = CCTPLiFiValidator.estimateGasCosts(
      tokenIn.chainId,
      tokenOut.chainId,
      hasSourceSwap,
      hasDestinationSwap,
    )

    const context: CCTPLiFiStrategyContext = {
      sourceSwapQuote,
      cctpTransfer: {
        sourceChain: tokenIn.chainId,
        destinationChain: tokenOut.chainId,
        amount: parseUnits(cctpAmount.toString(), 6), // USDC has 6 decimals
      },
      destinationSwapQuote,
      steps: steps.map((step) => step.type),
      gasEstimation,
      id,
    }

    return context
  }

  /**
   * Calculates total amount out and slippage for the route
   */
  private calculateTotals(
    context: CCTPLiFiStrategyContext,
    initialAmount: number,
  ): { totalAmountOut: bigint; totalSlippage: number } {
    const totalSlippage = SlippageCalculator.calculateTotalSlippage(context)

    // Calculate final amount out
    let amountOut = parseUnits(initialAmount.toString(), 6) // Start with initial amount in USDC decimals

    if (context.sourceSwapQuote) {
      amountOut = BigInt(context.sourceSwapQuote.toAmount)
    }

    // CCTP is 1:1, so no change to amount

    if (context.destinationSwapQuote) {
      amountOut = BigInt(context.destinationSwapQuote.toAmount)
    }

    return { totalAmountOut: amountOut, totalSlippage }
  }

  /**
   * Creates a USDC TokenData object for the given chain
   */
  private createUSDCTokenData(chainId: number): TokenData {
    const usdcAddress = CCTPLiFiRoutePlanner.getUSDCAddress(chainId)

    // Balance is not needed for quote generation - only decimals matter
    // The actual balance validation happens elsewhere if needed
    return {
      chainId,
      config: {
        address: usdcAddress,
        chainId,
        minBalance: 0,
        targetBalance: 0,
        type: 'erc20',
      },
      balance: {
        address: usdcAddress,
        decimals: 6, // USDC always has 6 decimals
        balance: 0n, // Not needed for quotes
      },
    }
  }

  /**
   * Executes source chain swap using LiFi
   */
  private async executeSourceSwap(
    walletAddress: string,
    sourceSwapQuote: LiFiStrategyContext,
  ): Promise<Hex> {
    // Source swap execution logged by parent operation context

    try {
      // Create proper token data for the swap
      const tokenIn = {
        chainId: sourceSwapQuote.fromChainId,
        config: {
          address: sourceSwapQuote.fromToken.address as Hex,
          chainId: sourceSwapQuote.fromChainId,
          minBalance: 0,
          targetBalance: 0,
          type: 'erc20' as const,
        },
        balance: {
          address: sourceSwapQuote.fromToken.address as Hex,
          decimals: sourceSwapQuote.fromToken.decimals,
          balance: 1000000000000000000n, // TODO: get balance from balance service
        },
      }

      const tokenOut = {
        chainId: sourceSwapQuote.toChainId,
        config: {
          address: sourceSwapQuote.toToken.address as Hex,
          chainId: sourceSwapQuote.toChainId,
          minBalance: 0,
          targetBalance: 0,
          type: 'erc20' as const,
        },
        balance: {
          address: sourceSwapQuote.toToken.address as Hex,
          decimals: sourceSwapQuote.toToken.decimals,
          balance: 0n,
        },
      }

      const quote = {
        tokenIn,
        tokenOut,
        amountIn: BigInt(sourceSwapQuote.fromAmount),
        amountOut: BigInt(sourceSwapQuote.toAmount),
        slippage:
          1 - parseFloat(sourceSwapQuote.toAmountMin) / parseFloat(sourceSwapQuote.fromAmount),
        strategy: this.liFiService.getStrategy(),
        context: sourceSwapQuote,
        id: sourceSwapQuote.id,
      }

      // Execute the LiFi swap with proper quote structure
      const lifiResult = await this.liFiService.execute(walletAddress, quote)

      // Extract transaction hash from LiFi RouteExtended result
      const txHash = this.extractTransactionHashFromLiFiResult(lifiResult, sourceSwapQuote.id)

      // Source swap success logged by parent operation context

      return txHash
    } catch (error) {
      this.ecoAnalytics.trackError(
        ANALYTICS_EVENTS.LIQUIDITY_MANAGER.CCTP_LIFI_SOURCE_SWAP_ERROR,
        error,
        {
          id: sourceSwapQuote.id,
          walletAddress,
          fromChain: sourceSwapQuote.fromChainId,
          toChain: sourceSwapQuote.toChainId,
          fromToken: sourceSwapQuote.fromToken.address,
          toToken: sourceSwapQuote.toToken.address,
          fromAmount: sourceSwapQuote.fromAmount,
          toAmount: sourceSwapQuote.toAmount,
          operation: 'source_swap_execution',
          service: this.constructor.name,
        },
      )

      // Source swap errors logged by parent decorator
      throw new Error(`Source swap failed: ${error.message}`)
    }
  }

  /**
   * Extracts the transaction hash from LiFi RouteExtended execution result
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private extractTransactionHashFromLiFiResult(lifiResult: any, id: string): Hex {
    // LiFi returns a RouteExtended object with execution details
    // First, try to extract from the first step's execution process
    if (lifiResult?.steps?.[0]?.execution?.process?.[0]?.txHash) {
      return lifiResult.steps[0].execution.process[0].txHash as Hex
    }

    // Check if there are multiple processes and get the last one (most recent)
    if (lifiResult?.steps?.[0]?.execution?.process?.length > 0) {
      const processes = lifiResult.steps[0].execution.process
      const lastProcess = processes[processes.length - 1]
      if (lastProcess?.txHash) {
        return lastProcess.txHash as Hex
      }
    }

    // Check for multiple steps and get the last completed one
    if (lifiResult?.steps?.length > 0) {
      for (let i = lifiResult.steps.length - 1; i >= 0; i--) {
        const step = lifiResult.steps[i]
        if (step?.execution?.process?.length > 0) {
          const processes = step.execution.process
          const lastProcess = processes[processes.length - 1]
          if (lastProcess?.txHash) {
            return lastProcess.txHash as Hex
          }
        }
      }
    }

    // Transaction hash extraction debugging logged by parent operation context

    return '0x0' as Hex
  }

  /**
   * Executes CCTP bridge operation
   */
  private async executeCCTPBridge(
    walletAddress: string,
    quote: RebalanceQuote<'CCTPLiFi'>,
  ): Promise<{ txHash: Hex; messageHash: Hex; messageBody: Hex }> {
    // CCTP bridge execution logged by parent operation context

    try {
      // Create a CCTP quote for the bridge operation
      const usdcTokenIn = this.createUSDCTokenData(quote.tokenIn.chainId)
      const usdcTokenOut = this.createUSDCTokenData(quote.tokenOut.chainId)
      const cctpAmount = Number(quote.context.cctpTransfer.amount) / 1e6 // Convert from wei to decimal

      const cctpQuote = await this.cctpService.getQuote(
        usdcTokenIn,
        usdcTokenOut,
        cctpAmount,
        quote.id,
      )

      // Use the enhanced CCTP service method that returns transaction metadata
      const result = await this.cctpService.executeWithMetadata(walletAddress, cctpQuote)

      return result
    } catch (error) {
      this.ecoAnalytics.trackError(
        ANALYTICS_EVENTS.LIQUIDITY_MANAGER.CCTP_LIFI_BRIDGE_ERROR,
        error,
        {
          id: quote.id,
          walletAddress,
          sourceChain: quote.tokenIn.chainId,
          destinationChain: quote.tokenOut.chainId,
          cctpAmount: Number(quote.context.cctpTransfer.amount) / 1e6,
          operation: 'cctp_bridge_execution',
          service: this.constructor.name,
        },
      )

      // CCTP bridge errors logged by parent decorator
      throw new Error(`CCTP bridge failed: ${error.message}, id: ${quote.id}`)
    }
  }
}
