import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { parseUnits, Hex, formatUnits } from 'viem'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
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
import { extractLiFiTxHash } from '@/liquidity-manager/services/liquidity-providers/LiFi/utils/get-transaction-hashes'
import { EcoError } from '@/common/errors/eco-error'

@Injectable()
export class CCTPLiFiProviderService implements IRebalanceProvider<'CCTPLiFi'> {
  private logger = new Logger(CCTPLiFiProviderService.name)
  private liquidityManagerQueue: LiquidityManagerQueue
  private config: CCTPLiFiConfig

  constructor(
    private readonly liFiService: LiFiProviderService,
    private readonly cctpService: CCTPProviderService,
    private readonly ecoConfigService: EcoConfigService,
    private readonly balanceService: BalanceService,
    @InjectQueue(LiquidityManagerQueue.queueName)
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

  async isRouteAvailable(tokenIn: TokenData, tokenOut: TokenData): Promise<boolean> {
    // Validate CCTP support for both chains
    if (!CCTPLiFiRoutePlanner.validateCCTPSupport(tokenIn.chainId, tokenOut.chainId)) {
      return false
    }

    // Validate same chain (CCTPLiFi is for cross-chain only)
    if (tokenIn.chainId === tokenOut.chainId) {
      return false
    }

    return true
  }

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    id?: string,
  ): Promise<RebalanceQuote<'CCTPLiFi'>> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCTPLiFi: Getting quote',
        id,
        properties: {
          tokenIn,
          tokenOut,
          swapAmount,
        },
      }),
    )

    // 1. Validate route availability
    if (!(await this.isRouteAvailable(tokenIn, tokenOut))) {
      throw EcoError.RebalancingRouteNotAvailable(
        tokenIn.chainId,
        tokenIn.config.address,
        tokenOut.chainId,
        tokenOut.config.address,
      )
    }

    // 2. Plan route steps
    const steps = CCTPLiFiRoutePlanner.planRoute(tokenIn, tokenOut)
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCTPLiFi: Route steps planned',
        id,
        properties: { steps },
      }),
    )

    // 3. Get quotes for each step and build context
    const context = await this.buildRouteContext(tokenIn, tokenOut, swapAmount, steps, id)

    // 4. Calculate total amounts and slippage
    const { totalAmountOut, totalSlippage } = this.calculateTotals(context, swapAmount)

    // 5. Final validation of calculated slippage
    if (totalSlippage > this.config.maxSlippage) {
      // TODO: what to do here?
      this.logger.warn(
        EcoLogMessage.withId({
          message: 'CCTPLiFi: High total slippage detected',
          id,
          properties: {
            totalSlippage,
            threshold: this.config.maxSlippage,
            route: steps,
          },
        }),
      )
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

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCTPLiFi: Quote generated successfully',
        id,
        properties: { quote },
      }),
    )

    return quote
  }

  async execute(walletAddress: string, quote: RebalanceQuote<'CCTPLiFi'>): Promise<unknown> {
    const { steps, sourceSwapQuote, destinationSwapQuote } = quote.context

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCTPLiFi: Starting execution',
        id: quote.id,
        properties: {
          walletAddress,
          steps,
          quote,
        },
      }),
    )

    try {
      let currentTxHash: Hex | undefined

      // Step 1: Source chain swap (if needed)
      if (steps.includes('sourceSwap') && sourceSwapQuote) {
        currentTxHash = await this.executeSourceSwap(walletAddress, sourceSwapQuote)
        this.logger.debug(
          EcoLogMessage.withId({
            message: 'CCTPLiFi: Source swap completed',
            id: quote.id,
            properties: { txHash: currentTxHash },
          }),
        )
      }

      // Step 2: CCTP bridge
      const cctpResult = await this.executeCCTPBridge(walletAddress, quote)
      this.logger.debug(
        EcoLogMessage.withId({
          message: 'CCTPLiFi: CCTP bridge initiated',
          id: quote.id,
          properties: {
            txHash: cctpResult.txHash,
            messageHash: cctpResult.messageHash,
          },
        }),
      )

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
      this.logger.debug(
        EcoLogMessage.withId({
          message: 'CCTPLiFi: CCTP attestation check queued',
          id: quote.id,
          properties: { checkCCTPAttestationJobData },
        }),
      )

      // Step 4: Log destination swap status
      if (steps.includes('destinationSwap') && destinationSwapQuote) {
        this.logger.debug(
          EcoLogMessage.withId({
            message:
              'CCTPLiFi: Destination swap will be automatically executed after CCTP attestation completes',
            id: quote.id,
            properties: { destinationSwapQuote },
          }),
        )
      } else {
        this.logger.debug(
          EcoLogMessage.withId({
            message:
              'CCTPLiFi: No destination swap needed. Execution will finish after CCTP operation completes',
            id: quote.id,
            properties: { quote },
          }),
        )
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

      this.logger.error(
        EcoLogMessage.withErrorAndId({
          error,
          id: quote.id,
          message: 'CCTPLiFi execution failed',
          properties: { id: quote.id, quote, walletAddress },
        }),
      )
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

        this.logger.debug(
          EcoLogMessage.withId({
            message: 'CCTPLiFi: Source swap quote obtained',
            id,
            properties: {
              tokenIn,
              tokenOut: usdcTokenData,
              amount: swapAmount,
              sourceSwapQuote,
            },
          }),
        )
      }

      // Get destination swap quote if needed
      if (steps.some((step) => step.type === 'destinationSwap')) {
        const usdcTokenData = this.createUSDCTokenData(tokenOut.chainId)
        const destQuote = await this.liFiService.getQuote(usdcTokenData, tokenOut, cctpAmount, id)
        destinationSwapQuote = destQuote.context

        this.logger.debug(
          EcoLogMessage.withId({
            message: 'CCTPLiFi: Destination swap quote obtained',
            id,
            properties: {
              tokenIn: usdcTokenData,
              tokenOut,
              amount: cctpAmount,
              destinationSwapQuote,
            },
          }),
        )
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

      this.logger.error(
        EcoLogMessage.withErrorAndId({
          error,
          id,
          message: 'CCTPLiFi: Failed to get quotes for route steps',
          properties: { id },
        }),
      )
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
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCTPLiFi: Executing source swap',
        id: sourceSwapQuote.id,
        properties: {
          sourceSwapQuote,
          walletAddress,
        },
      }),
    )

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
      const txHash = extractLiFiTxHash(lifiResult) ?? ('0x0' as Hex)

      if (txHash === '0x0') {
        // Log the structure we received for debugging
        this.logger.debug(
          EcoLogMessage.withId({
            message: 'CCTPLiFi: Could not extract transaction hash from LiFi result',
            id: sourceSwapQuote.id,
            properties: {
              resultStructure: Object.keys(lifiResult || {}),
              stepsCount: lifiResult?.steps?.length || 0,
              firstStepStructure: lifiResult?.steps?.[0] ? Object.keys(lifiResult.steps[0]) : [],
              executionStructure: lifiResult?.steps?.[0]?.execution
                ? Object.keys(lifiResult.steps[0].execution)
                : [],
            },
          }),
        )
      }

      this.logger.debug(
        EcoLogMessage.withId({
          message: 'CCTPLiFi: Source swap executed successfully',
          id: sourceSwapQuote.id,
          properties: {
            txHash,
            fromAmount: sourceSwapQuote.fromAmount,
            toAmount: sourceSwapQuote.toAmount,
          },
        }),
      )

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

      this.logger.error(
        EcoLogMessage.withErrorAndId({
          error,
          id: sourceSwapQuote.id,
          message: 'CCTPLiFi: Source swap failed',
          properties: { id: sourceSwapQuote.id },
        }),
      )
      throw new Error(`Source swap failed: ${error.message}`)
    }
  }

  /**
   * Executes CCTP bridge operation
   */
  private async executeCCTPBridge(
    walletAddress: string,
    quote: RebalanceQuote<'CCTPLiFi'>,
  ): Promise<{ txHash: Hex; messageHash: Hex; messageBody: Hex }> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCTPLiFi: Executing CCTP bridge',
        id: quote.id,
        properties: { quote, walletAddress },
      }),
    )

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

      this.logger.error(
        EcoLogMessage.withErrorAndId({
          error,
          id: quote.id,
          message: 'CCTPLiFi: CCTP bridge failed',
          properties: { id: quote.id, quote, walletAddress },
        }),
      )
      throw new Error(`CCTP bridge failed: ${error.message}, id: ${quote.id}`)
    }
  }
}
