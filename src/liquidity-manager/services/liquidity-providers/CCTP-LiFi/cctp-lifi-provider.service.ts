import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { parseUnits, Hex } from 'viem'
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
import { SlippageCalculator } from './utils/slippage-calculator'
import { CCTPLiFiValidator } from './utils/validation'
import { CCTPLiFiConfig } from '@/eco-configs/eco-config.types'

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
  ) {
    this.liquidityManagerQueue = new LiquidityManagerQueue(queue)
    this.config = this.ecoConfigService.getCCTPLiFiConfig()

    // Initialize CCTPLiFiRoutePlanner with config values
    CCTPLiFiRoutePlanner.updateUSDCAddresses(this.config.usdcAddresses)
  }

  getStrategy() {
    return 'CCTPLiFi' as const
  }

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
  ): Promise<RebalanceQuote<'CCTPLiFi'>> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'CCTPLiFi: Getting quote',
        properties: {
          tokenIn: tokenIn.config.address,
          chainIn: tokenIn.chainId,
          tokenOut: tokenOut.config.address,
          chainOut: tokenOut.chainId,
          swapAmount,
        },
      }),
    )

    // 1. Enhanced pre-checks: CCTP compatibility and validation
    const validation = CCTPLiFiValidator.validateAdvanced(tokenIn, tokenOut, swapAmount, {
      maxSlippage: this.config.maxSlippage,
      minLiquidityUSD: this.config.minLiquidityUSD,
      skipBalanceCheck: this.config.skipBalanceCheck,
      skipGasEstimation: this.config.skipGasEstimation,
    })

    if (!validation.isValid) {
      const errorMessage = `Invalid CCTPLiFi route: ${validation.errors.join(', ')}`
      this.logger.error(errorMessage, { validation })
      throw new Error(errorMessage)
    }

    // Log any warnings
    if (validation.warnings && validation.warnings.length > 0) {
      this.logger.warn('CCTPLiFi route validation warnings', {
        warnings: validation.warnings,
        tokenIn: tokenIn.config.address,
        tokenOut: tokenOut.config.address,
        swapAmount,
      })
    }

    // 2. Plan route steps
    const steps = CCTPLiFiRoutePlanner.planRoute(tokenIn, tokenOut)
    this.logger.debug('CCTPLiFi: Route steps planned', { steps: steps.map((s) => s.type) })

    // 3. Get quotes for each step and build context
    const context = await this.buildRouteContext(tokenIn, tokenOut, swapAmount, steps)

    // 4. Calculate total amounts and slippage
    const { totalAmountOut, totalSlippage } = this.calculateTotals(context, swapAmount)

    // 5. Final validation of calculated slippage
    if (totalSlippage > 0.05) {
      this.logger.warn('CCTPLiFi: High total slippage detected', {
        totalSlippage,
        threshold: 0.05,
        route: steps.map((s) => s.type),
      })
    }

    context.totalSlippage = totalSlippage

    // 6. Log gas estimation warnings if present
    if (context.gasEstimation && context.gasEstimation.gasWarnings.length > 0) {
      this.logger.warn('CCTPLiFi: Gas estimation warnings', {
        gasWarnings: context.gasEstimation.gasWarnings,
        totalGasUSD: context.gasEstimation.totalGasUSD,
        sourceChain: tokenIn.chainId,
        destinationChain: tokenOut.chainId,
      })
    }

    const quote: RebalanceQuote<'CCTPLiFi'> = {
      amountIn: parseUnits(swapAmount.toString(), tokenIn.balance.decimals),
      amountOut: totalAmountOut,
      slippage: totalSlippage,
      tokenIn,
      tokenOut,
      strategy: this.getStrategy(),
      context,
    }

    this.logger.debug('CCTPLiFi: Quote generated successfully', {
      amountIn: quote.amountIn.toString(),
      amountOut: quote.amountOut.toString(),
      slippage: quote.slippage,
      totalSteps: context.steps.length,
      estimatedGasUSD: context.gasEstimation?.totalGasUSD,
    })

    return quote
  }

  async execute(walletAddress: string, quote: RebalanceQuote<'CCTPLiFi'>): Promise<unknown> {
    const { steps, sourceSwapQuote, destinationSwapQuote } = quote.context

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'CCTPLiFi: Starting execution',
        properties: {
          walletAddress,
          steps,
          sourceChain: quote.tokenIn.chainId,
          destinationChain: quote.tokenOut.chainId,
          totalSlippage: quote.context.totalSlippage,
        },
      }),
    )

    try {
      let currentTxHash: Hex | undefined

      // Step 1: Source chain swap (if needed)
      if (steps.includes('sourceSwap') && sourceSwapQuote) {
        currentTxHash = await this.executeSourceSwap(walletAddress, sourceSwapQuote)
        this.logger.debug('CCTPLiFi: Source swap completed', { txHash: currentTxHash })
      }

      // Step 2: CCTP bridge
      const cctpResult = await this.executeCCTPBridge(walletAddress, quote)
      this.logger.debug('CCTPLiFi: CCTP bridge initiated', {
        txHash: cctpResult.txHash,
        messageHash: cctpResult.messageHash,
      })

      // Step 3: Always queue CCTP attestation check since CCTP is async
      await this.liquidityManagerQueue.startCCTPAttestationCheck({
        destinationChainId: quote.tokenOut.chainId,
        messageHash: cctpResult.messageHash,
        messageBody: cctpResult.messageBody,
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
      })
      this.logger.debug('CCTPLiFi: CCTP attestation check queued')

      // Step 4: Log destination swap status
      if (steps.includes('destinationSwap') && destinationSwapQuote) {
        this.logger.debug(
          'CCTPLiFi: Destination swap will be automatically executed after CCTP attestation completes',
        )
      } else {
        this.logger.debug('CCTPLiFi: No destination swap needed - CCTP operation complete')
      }

      return cctpResult.txHash
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          error,
          message: 'CCTPLiFi execution failed',
          properties: { quote, walletAddress },
        }),
      )
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
  ): Promise<CCTPLiFiStrategyContext> {
    let sourceSwapQuote: LiFiStrategyContext | undefined
    let destinationSwapQuote: LiFiStrategyContext | undefined
    let cctpAmount = swapAmount

    try {
      // Get source swap quote if needed
      if (steps.some((step) => step.type === 'sourceSwap')) {
        const usdcTokenData = this.createUSDCTokenData(tokenIn.chainId)
        const sourceQuote = await this.liFiService.getQuote(tokenIn, usdcTokenData, swapAmount)
        sourceSwapQuote = sourceQuote.context
        cctpAmount = parseFloat(sourceQuote.context.toAmount)

        this.logger.debug('CCTPLiFi: Source swap quote obtained', {
          originalAmount: swapAmount,
          usdcAmount: cctpAmount,
          slippage: sourceQuote.slippage,
        })
      }

      // Get destination swap quote if needed
      if (steps.some((step) => step.type === 'destinationSwap')) {
        const usdcTokenData = this.createUSDCTokenData(tokenOut.chainId)
        const destQuote = await this.liFiService.getQuote(usdcTokenData, tokenOut, cctpAmount)
        destinationSwapQuote = destQuote.context

        this.logger.debug('CCTPLiFi: Destination swap quote obtained', {
          usdcAmount: cctpAmount,
          finalAmount: parseFloat(destQuote.context.toAmount),
          slippage: destQuote.slippage,
        })
      }
    } catch (error) {
      this.logger.error('CCTPLiFi: Failed to get quotes for route steps', { error })
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

    this.logger.debug('CCTPLiFi: Gas estimation completed', {
      sourceChainGas: gasEstimation.sourceChainGas.toString(),
      destinationChainGas: gasEstimation.destinationChainGas.toString(),
      totalGasUSD: gasEstimation.totalGasUSD,
      gasWarnings: gasEstimation.gasWarnings,
    })

    const context: CCTPLiFiStrategyContext = {
      sourceSwapQuote,
      cctpTransfer: {
        sourceChain: tokenIn.chainId,
        destinationChain: tokenOut.chainId,
        amount: parseUnits(cctpAmount.toString(), 6), // USDC has 6 decimals
      },
      destinationSwapQuote,
      steps: steps.map((step) => step.type),
      totalSlippage: 0, // Will be calculated in calculateTotals
      gasEstimation,
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
    context.totalSlippage = totalSlippage

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
    this.logger.debug('CCTPLiFi: Executing source swap')

    try {
      // Create proper token data for the swap
      const tokenIn = {
        chainId: sourceSwapQuote.fromChainId,
        config: {
          address: sourceSwapQuote.fromAddress as Hex,
          chainId: sourceSwapQuote.fromChainId,
          minBalance: 0,
          targetBalance: 0,
          type: 'erc20' as const,
        },
        balance: {
          address: sourceSwapQuote.fromAddress as Hex,
          decimals: 6, // Assuming 6 decimals - could be enhanced with actual token info
          balance: BigInt(sourceSwapQuote.fromAmount),
        },
      }

      const tokenOut = {
        chainId: sourceSwapQuote.toChainId,
        config: {
          address: sourceSwapQuote.toAddress as Hex,
          chainId: sourceSwapQuote.toChainId,
          minBalance: 0,
          targetBalance: 0,
          type: 'erc20' as const,
        },
        balance: {
          address: sourceSwapQuote.toAddress as Hex,
          decimals: 6, // USDC has 6 decimals
          balance: 0n,
        },
      }

      // Execute the LiFi swap with proper quote structure
      const lifiResult = await this.liFiService.execute(walletAddress, {
        tokenIn,
        tokenOut,
        amountIn: BigInt(sourceSwapQuote.fromAmount),
        amountOut: BigInt(sourceSwapQuote.toAmount),
        slippage:
          1 - parseFloat(sourceSwapQuote.toAmountMin) / parseFloat(sourceSwapQuote.toAmount),
        strategy: 'LiFi' as const,
        context: sourceSwapQuote,
      })

      // Extract transaction hash from LiFi RouteExtended result
      const txHash = this.extractTransactionHashFromLiFiResult(lifiResult)

      this.logger.debug('CCTPLiFi: Source swap executed successfully', {
        txHash,
        fromAmount: sourceSwapQuote.fromAmount,
        toAmount: sourceSwapQuote.toAmount,
      })

      return txHash
    } catch (error) {
      this.logger.error('CCTPLiFi: Source swap failed', { error })
      throw new Error(`Source swap failed: ${error.message}`)
    }
  }

  /**
   * Extracts the transaction hash from LiFi RouteExtended execution result
   */
  private extractTransactionHashFromLiFiResult(lifiResult: any): Hex {
    try {
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

      // Fallback: check for transaction hash in different locations
      if (lifiResult?.transactionHash) {
        return lifiResult.transactionHash as Hex
      }

      if (lifiResult?.txHash) {
        return lifiResult.txHash as Hex
      }

      // Log the structure we received for debugging
      this.logger.warn('CCTPLiFi: Could not extract transaction hash from LiFi result', {
        resultStructure: Object.keys(lifiResult || {}),
        stepsCount: lifiResult?.steps?.length || 0,
        firstStepStructure: lifiResult?.steps?.[0] ? Object.keys(lifiResult.steps[0]) : [],
        executionStructure: lifiResult?.steps?.[0]?.execution
          ? Object.keys(lifiResult.steps[0].execution)
          : [],
      })

      throw new Error('Could not extract transaction hash from LiFi execution result')
    } catch (error) {
      this.logger.error('CCTPLiFi: Error extracting transaction hash from LiFi result', {
        error: error.message,
      })
      throw new Error(`Failed to extract LiFi transaction hash: ${error.message}`)
    }
  }

  /**
   * Executes CCTP bridge operation
   */
  private async executeCCTPBridge(
    walletAddress: string,
    quote: RebalanceQuote<'CCTPLiFi'>,
  ): Promise<{ txHash: Hex; messageHash: Hex; messageBody: Hex }> {
    this.logger.debug('CCTPLiFi: Executing CCTP bridge')

    try {
      // Create a CCTP quote for the bridge operation
      const usdcTokenIn = this.createUSDCTokenData(quote.tokenIn.chainId)
      const usdcTokenOut = this.createUSDCTokenData(quote.tokenOut.chainId)
      const cctpAmount = Number(quote.context.cctpTransfer.amount) / 1e6 // Convert from wei to decimal

      const cctpQuote = await this.cctpService.getQuote(usdcTokenIn, usdcTokenOut, cctpAmount)

      // Use the enhanced CCTP service method that returns transaction metadata
      const result = await this.cctpService.executeWithMetadata(walletAddress, cctpQuote)

      this.logger.debug('CCTPLiFi: CCTP bridge executed successfully', {
        txHash: result.txHash,
        messageHash: result.messageHash,
        amount: cctpAmount,
        sourceChain: quote.tokenIn.chainId,
        destinationChain: quote.tokenOut.chainId,
      })

      return result
    } catch (error) {
      this.logger.error('CCTPLiFi: CCTP bridge failed', { error })
      throw new Error(`CCTP bridge failed: ${error.message}`)
    }
  }
}
