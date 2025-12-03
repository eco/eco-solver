import { Injectable, Logger } from '@nestjs/common'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import {
  RebalanceQuote,
  TokenData,
  CCIPLiFiStrategyContext,
  LiFiStrategyContext,
} from '@/liquidity-manager/types/types'
import { InjectQueue } from '@nestjs/bullmq'
import {
  LiquidityManagerQueue,
  LiquidityManagerQueueType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { CCIPProviderService } from '@/liquidity-manager/services/liquidity-providers/CCIP/ccip-provider.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { CCIPLiFiConfig, CCIPTokenConfig } from '@/eco-configs/eco-config.types'
import { CCIPLiFiRoutePlanner, RouteStep, CCIPRouteValidator } from './utils/route-planner'
import * as SlippageCalculator from './utils/slippage-calculator'
import { CCIPLiFiValidator } from './utils/validation'
import { parseUnits, formatUnits, Hex, isAddressEqual } from 'viem'
import { EcoAnalyticsService } from '@/analytics/eco-analytics.service'
import { ANALYTICS_EVENTS } from '@/analytics/events.constants'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@/common/logging/eco-log-message'

@Injectable()
export class CCIPLiFiProviderService implements IRebalanceProvider<'CCIPLiFi'> {
  private readonly logger = new Logger(CCIPLiFiProviderService.name)
  private readonly liquidityManagerQueue: LiquidityManagerQueue
  private readonly config: CCIPLiFiConfig

  constructor(
    private readonly liFiService: LiFiProviderService,
    private readonly ccipService: CCIPProviderService,
    private readonly ecoConfigService: EcoConfigService,
    private readonly ecoAnalytics: EcoAnalyticsService,
    private readonly rebalanceRepository: RebalanceRepository,
    @InjectQueue(LiquidityManagerQueue.queueName)
    private readonly queue: LiquidityManagerQueueType,
  ) {
    this.liquidityManagerQueue = new LiquidityManagerQueue(queue)
    this.config = this.ecoConfigService.getCCIPLiFiConfig()
    CCIPLiFiRoutePlanner.updateBridgeTokens(this.config.bridgeTokens)
  }

  /**
   * Creates a validator function that checks if a CCIP route is available
   * by delegating to CCIPProviderService.isRouteAvailable().
   */
  private createCCIPRouteValidator(): CCIPRouteValidator {
    return async (sourceChainId: number, destChainId: number, tokenSymbol: string) => {
      const bridgeTokens = CCIPLiFiRoutePlanner.getBridgeTokens()
      const sourceAddress = bridgeTokens[sourceChainId]?.[tokenSymbol]
      const destAddress = bridgeTokens[destChainId]?.[tokenSymbol]

      if (!sourceAddress || !destAddress) {
        return false
      }

      // Create minimal TokenData for the bridge tokens to check CCIP availability
      const bridgeTokenIn = this.createBridgeTokenData(sourceChainId, sourceAddress)
      const bridgeTokenOut = this.createBridgeTokenData(destChainId, destAddress)

      return this.ccipService.isRouteAvailable(bridgeTokenIn, bridgeTokenOut)
    }
  }

  getStrategy() {
    return 'CCIPLiFi' as const
  }

  async isRouteAvailable(tokenIn: TokenData, tokenOut: TokenData): Promise<boolean> {
    if (tokenIn.chainId === tokenOut.chainId) {
      return false
    }

    const validator = this.createCCIPRouteValidator()
    return CCIPLiFiRoutePlanner.validateCCIPSupportAsync(
      tokenIn.chainId,
      tokenOut.chainId,
      validator,
    )
  }

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    id?: string,
  ): Promise<RebalanceQuote<'CCIPLiFi'>> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCIPLiFi: getQuote start',
        id,
        properties: {
          sourceChain: tokenIn.chainId,
          destinationChain: tokenOut.chainId,
          swapAmount,
        },
      }),
    )

    // Select a bridge token with a valid CCIP lane
    const validator = this.createCCIPRouteValidator()
    let bridgeToken
    try {
      bridgeToken = await CCIPLiFiRoutePlanner.selectBridgeTokenAsync(
        tokenIn.chainId,
        tokenOut.chainId,
        validator,
      )
    } catch {
      throw EcoError.RebalancingRouteNotAvailable(
        tokenIn.chainId,
        tokenIn.config.address,
        tokenOut.chainId,
        tokenOut.config.address,
      )
    }

    const plannedRoute = CCIPLiFiRoutePlanner.planRoute(tokenIn, tokenOut, bridgeToken)
    const context = await this.buildRouteContext(
      tokenIn,
      tokenOut,
      swapAmount,
      plannedRoute.steps,
      {
        id,
        bridgeToken: plannedRoute.bridgeToken,
      },
    )
    const { totalAmountOut, totalSlippage } = this.calculateTotals(context, swapAmount)

    const quote: RebalanceQuote<'CCIPLiFi'> = {
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
        message: 'CCIPLiFi: quote generated',
        id,
        properties: {
          totalSlippage,
          steps: context.steps,
        },
      }),
    )

    return quote
  }

  async execute(walletAddress: string, quote: RebalanceQuote<'CCIPLiFi'>): Promise<unknown> {
    const { steps, sourceSwapQuote, destinationSwapQuote } = quote.context

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCIPLiFi: execute start',
        id: quote.id,
        properties: { steps, walletAddress },
      }),
    )

    try {
      // Step 1: Source swap if needed
      if (steps.includes('sourceSwap') && sourceSwapQuote) {
        await this.executeSourceSwap(walletAddress, sourceSwapQuote, quote.id)
      }

      // Step 2: Build CCIP quote with destination swap context
      const ccipQuote = await this.buildCCIPQuote(quote, destinationSwapQuote, walletAddress)

      // Step 3: Execute CCIP bridge (this queues delivery check with ccipLiFiContext)
      const txHash = await this.ccipService.execute(walletAddress, ccipQuote as any)

      this.logger.debug(
        EcoLogMessage.withId({
          message: 'CCIPLiFi: CCIP bridge submitted',
          id: quote.id,
          properties: { txHash },
        }),
      )

      return txHash
    } catch (error) {
      this.ecoAnalytics.trackError(
        ANALYTICS_EVENTS.LIQUIDITY_MANAGER.CCIP_LIFI_EXECUTION_ERROR,
        error,
        {
          id: quote.id,
          walletAddress,
          sourceChain: quote.tokenIn.chainId,
          destinationChain: quote.tokenOut.chainId,
          amountIn: quote.amountIn.toString(),
          amountOut: quote.amountOut.toString(),
          steps,
          service: this.constructor.name,
        },
      )

      this.logger.error(
        EcoLogMessage.withErrorAndId({
          message: 'CCIPLiFi: execution failed',
          id: quote.id,
          error: error as any,
          properties: { walletAddress },
        }),
      )

      try {
        if (quote.rebalanceJobID) {
          await this.rebalanceRepository.updateStatus(quote.rebalanceJobID, RebalanceStatus.FAILED)
        }
      } catch {
        // ignore
      }

      throw error
    }
  }

  private async buildRouteContext(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    steps: RouteStep[],
    options: {
      id?: string
      bridgeToken: { symbol: string; sourceAddress: Hex; destinationAddress: Hex }
    },
  ): Promise<CCIPLiFiStrategyContext> {
    const { bridgeToken } = options
    let sourceSwapQuote: LiFiStrategyContext | undefined
    let destinationSwapQuote: LiFiStrategyContext | undefined
    let bridgeDecimals = this.getBridgeTokenInfo(
      tokenIn.chainId,
      bridgeToken.sourceAddress,
    ).decimals
    let ccipAmountDecimal = swapAmount

    // Get source swap quote if needed
    if (steps.some((step) => step.type === 'sourceSwap')) {
      const bridgeTokenData = this.createBridgeTokenData(tokenIn.chainId, bridgeToken.sourceAddress)
      bridgeDecimals = bridgeTokenData.balance.decimals
      const sourceQuote = await this.liFiService.getQuote(
        tokenIn,
        bridgeTokenData,
        swapAmount,
        options.id,
      )
      sourceSwapQuote = sourceQuote.context
      ccipAmountDecimal = Number(formatUnits(BigInt(sourceSwapQuote.toAmount), bridgeDecimals))
    }

    // Get destination swap quote if needed
    if (steps.some((step) => step.type === 'destinationSwap')) {
      const bridgeTokenData = this.createBridgeTokenData(
        tokenOut.chainId,
        bridgeToken.destinationAddress,
      )
      const destQuote = await this.liFiService.getQuote(
        bridgeTokenData,
        tokenOut,
        ccipAmountDecimal,
        options.id,
      )
      destinationSwapQuote = destQuote.context
    }

    const ccipTransferAmount = parseUnits(ccipAmountDecimal.toString(), bridgeDecimals)

    const gasEstimation = CCIPLiFiValidator.estimateGasCosts(
      tokenIn.chainId,
      tokenOut.chainId,
      steps.some((step) => step.type === 'sourceSwap'),
      steps.some((step) => step.type === 'destinationSwap'),
    )

    return {
      sourceSwapQuote,
      ccipTransfer: {
        sourceChain: tokenIn.chainId,
        destinationChain: tokenOut.chainId,
        bridgeTokenSymbol: bridgeToken.symbol,
        bridgeTokenAddress: bridgeToken.sourceAddress,
        amount: ccipTransferAmount,
      },
      destinationSwapQuote,
      steps: steps.map((step) => step.type),
      gasEstimation,
      id: options.id,
    }
  }

  private calculateTotals(
    context: CCIPLiFiStrategyContext,
    initialAmount: number,
  ): { totalAmountOut: bigint; totalSlippage: number } {
    const totalSlippage = SlippageCalculator.calculateTotalSlippage(context)
    let amountOut = parseUnits(initialAmount.toString(), 6)

    if (context.sourceSwapQuote) {
      amountOut = BigInt(context.sourceSwapQuote.toAmount)
    }

    if (context.destinationSwapQuote) {
      amountOut = BigInt(context.destinationSwapQuote.toAmount)
    }

    return { totalAmountOut: amountOut, totalSlippage }
  }

  private createBridgeTokenData(chainId: number, address: Hex): TokenData {
    const tokenInfo = this.getBridgeTokenInfo(chainId, address)
    return {
      chainId,
      config: {
        address,
        chainId,
        minBalance: 0,
        targetBalance: 0,
        type: 'erc20',
      },
      balance: {
        address,
        decimals: tokenInfo.decimals,
        balance: 0n,
      },
    } as TokenData
  }

  private getBridgeTokenInfo(chainId: number, address: Hex): CCIPTokenConfig {
    const ccipConfig = this.ecoConfigService.getCCIP()
    const chain = ccipConfig.chains.find((c) => c.chainId === chainId)
    if (!chain) {
      throw new Error(`CCIPLiFi: Chain ${chainId} not configured in CCIP`)
    }
    const tokenConfig = Object.values(chain.tokens).find((token) =>
      isAddressEqual(token.address as Hex, address),
    )
    if (!tokenConfig) {
      throw new Error(`CCIPLiFi: Token ${address} not configured for chain ${chainId}`)
    }
    return tokenConfig
  }

  private async executeSourceSwap(
    walletAddress: string,
    context: LiFiStrategyContext,
    id?: string,
  ): Promise<void> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCIPLiFi: executing source swap',
        id,
        properties: {
          fromChain: context.fromChainId,
          toChain: context.toChainId,
          fromToken: context.fromToken.address,
          toToken: context.toToken.address,
        },
      }),
    )

    const tokenIn = {
      chainId: context.fromChainId,
      config: {
        address: context.fromToken.address as Hex,
        chainId: context.fromChainId,
        minBalance: 0,
        targetBalance: 0,
        type: 'erc20' as const,
      },
      balance: {
        address: context.fromToken.address as Hex,
        decimals: context.fromToken.decimals,
        balance: 1000000000000000000n,
      },
    }

    const tokenOut = {
      chainId: context.toChainId,
      config: {
        address: context.toToken.address as Hex,
        chainId: context.toChainId,
        minBalance: 0,
        targetBalance: 0,
        type: 'erc20' as const,
      },
      balance: {
        address: context.toToken.address as Hex,
        decimals: context.toToken.decimals,
        balance: 0n,
      },
    }

    const quote = {
      tokenIn,
      tokenOut,
      amountIn: BigInt(context.fromAmount),
      amountOut: BigInt(context.toAmount),
      slippage: 1 - parseFloat(context.toAmountMin) / parseFloat(context.fromAmount),
      strategy: this.liFiService.getStrategy(),
      context,
      id,
    }

    await this.liFiService.execute(walletAddress, quote as any)
  }

  private async buildCCIPQuote(
    quote: RebalanceQuote<'CCIPLiFi'>,
    destinationSwapQuote: LiFiStrategyContext | undefined,
    walletAddress: string,
  ) {
    const bridgeTokenAddress = quote.context.ccipTransfer.bridgeTokenAddress
    const bridgeSymbol = quote.context.ccipTransfer.bridgeTokenSymbol

    const tokenIn = this.createBridgeTokenData(quote.tokenIn.chainId, bridgeTokenAddress)

    // Get destination chain bridge token address
    const ccipConfig = this.ecoConfigService.getCCIP()
    const destChain = ccipConfig.chains.find((c) => c.chainId === quote.tokenOut.chainId)
    const destTokenConfig = destChain?.tokens[bridgeSymbol]
    if (!destTokenConfig) {
      throw new Error(
        `CCIPLiFi: Bridge token ${bridgeSymbol} not configured on chain ${quote.tokenOut.chainId}`,
      )
    }

    const tokenOut = this.createBridgeTokenData(
      quote.tokenOut.chainId,
      destTokenConfig.address as Hex,
    )

    const amountDecimal = Number(
      formatUnits(quote.context.ccipTransfer.amount, tokenIn.balance.decimals),
    )

    const ccipQuote = await this.ccipService.getQuote(tokenIn, tokenOut, amountDecimal, quote.id)
    ccipQuote.groupID = quote.groupID
    ccipQuote.rebalanceJobID = quote.rebalanceJobID
    ccipQuote.id = quote.id

    // Attach ccipLiFiContext for destination swap after CCIP delivery
    if (destinationSwapQuote) {
      ;(ccipQuote.context as any).ccipLiFiContext = {
        destinationSwapQuote,
        walletAddress,
        originalTokenOut: {
          address: quote.tokenOut.config.address as Hex,
          chainId: quote.tokenOut.chainId,
          decimals: quote.tokenOut.balance.decimals,
        },
      }
    }

    return ccipQuote
  }
}
