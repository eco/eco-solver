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
  USDT0LiFiStrategyContext,
  LiFiStrategyContext,
} from '@/liquidity-manager/types/types'
import {
  LiquidityManagerQueue,
  LiquidityManagerQueueType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { USDT0ProviderService } from '@/liquidity-manager/services/liquidity-providers/USDT0/usdt0-provider.service'
import { USDT0LiFiRoutePlanner, RouteStep } from './utils/route-planner'
import * as SlippageCalculator from './utils/slippage-calculator'
import { USDT0LiFiValidator } from './utils/validation'
import { EcoAnalyticsService } from '@/analytics/eco-analytics.service'
import { ANALYTICS_EVENTS } from '@/analytics/events.constants'

@Injectable()
export class USDT0LiFiProviderService implements IRebalanceProvider<'USDT0LiFi'> {
  private logger = new Logger(USDT0LiFiProviderService.name)
  private liquidityManagerQueue: LiquidityManagerQueue

  constructor(
    private readonly liFiService: LiFiProviderService,
    private readonly usdt0Service: USDT0ProviderService,
    private readonly ecoConfigService: EcoConfigService,
    private readonly balanceService: BalanceService,
    @InjectQueue(LiquidityManagerQueue.queueName)
    private readonly queue: LiquidityManagerQueueType,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {
    this.liquidityManagerQueue = new LiquidityManagerQueue(queue)

    // Initialize USDT addresses from config
    const cfg = this.ecoConfigService.getUSDT0()
    const addresses: Record<number, Hex> = {}
    for (const c of cfg.chains) {
      const token = (c.underlyingToken ?? c.token) as Hex
      if (token) addresses[c.chainId] = token
    }
    USDT0LiFiRoutePlanner.updateUSDTAddresses(addresses)
  }

  getStrategy() {
    return 'USDT0LiFi' as const
  }

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    id?: string,
  ): Promise<RebalanceQuote<'USDT0LiFi'>> {
    const { maxQuoteSlippage } = this.ecoConfigService.getLiquidityManager()

    const validation = USDT0LiFiValidator.validateRoute(
      tokenIn,
      tokenOut,
      swapAmount,
      maxQuoteSlippage,
    )
    if (!validation.isValid) {
      const errorMessage = `Invalid USDT0LiFi route: ${validation.errors.join(', ')}`
      this.logger.error(
        EcoLogMessage.withErrorAndId({
          error: new Error(errorMessage),
          id,
          message: 'USDT0LiFi route validation errors',
          properties: { validation },
        }),
      )
      throw new Error(errorMessage)
    }

    if (validation.warnings?.length) {
      this.logger.warn(
        EcoLogMessage.withId({
          message: 'USDT0LiFi route validation warnings',
          id,
          properties: { warnings: validation.warnings, tokenIn, tokenOut, swapAmount },
        }),
      )
    }

    const steps = USDT0LiFiRoutePlanner.planRoute(tokenIn, tokenOut)
    const context = await this.buildRouteContext(tokenIn, tokenOut, swapAmount, steps, id)
    const { totalAmountOut, totalSlippage } = this.calculateTotals(context, swapAmount)

    const quote: RebalanceQuote<'USDT0LiFi'> = {
      amountIn: parseUnits(swapAmount.toString(), tokenIn.balance.decimals),
      amountOut: totalAmountOut,
      slippage: totalSlippage,
      tokenIn,
      tokenOut,
      strategy: this.getStrategy(),
      context,
      id,
    }

    return quote
  }

  async execute(walletAddress: string, quote: RebalanceQuote<'USDT0LiFi'>): Promise<unknown> {
    const { steps, sourceSwapQuote, destinationSwapQuote } = quote.context

    try {
      // Step 1: Source swap
      if (steps.includes('sourceSwap') && sourceSwapQuote) {
        const txHash = await this.executeSourceSwap(walletAddress, sourceSwapQuote)
        this.logger.debug(
          EcoLogMessage.withId({
            message: 'USDT0LiFi: Source swap completed',
            id: quote.id,
            properties: { txHash },
          }),
        )
      }

      // Step 2: Bridge via USDT0
      const usdt0Quote = await this.buildUSDT0Quote(quote)

      // Attach USDT0-LiFi context into delivery check so onComplete schedules destination swap
      const txHash = (await this.usdt0Service.execute(walletAddress, usdt0Quote as any)) as Hex

      // USDT0ProviderService internally enqueues CheckOFTDeliveryJob; we cannot inject extra context there,
      // so we enqueue another delivery check with our context (safe duplication; scan job is idempotent-ish).
      const data: any = {
        groupID: quote.groupID!,
        rebalanceJobID: quote.rebalanceJobID!,
        sourceChainId: quote.tokenIn.chainId,
        destinationChainId: quote.tokenOut.chainId,
        txHash,
        walletAddress: walletAddress as Hex,
        amountLD: quote.context.oftTransfer.amount.toString(),
        id: quote.id,
        usdt0LiFiContext:
          steps.includes('destinationSwap') && destinationSwapQuote
            ? {
                destinationSwapQuote,
                walletAddress,
                originalTokenOut: {
                  address: destinationSwapQuote.toToken.address as Hex,
                  chainId: quote.tokenOut.chainId,
                  decimals: quote.tokenOut.balance.decimals,
                },
              }
            : undefined,
      }
      await this.liquidityManagerQueue.startOFTDeliveryCheck(data)

      return txHash
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
          operation: 'usdt0_lifi_execution',
          service: this.constructor.name,
        },
      )

      this.logger.error(
        EcoLogMessage.withErrorAndId({
          error,
          id: quote.id,
          message: 'USDT0LiFi execution failed',
          properties: { id: quote.id, quote, walletAddress },
        }),
      )
      throw error
    }
  }

  private async buildRouteContext(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    steps: RouteStep[],
    id?: string,
  ): Promise<USDT0LiFiStrategyContext> {
    let sourceSwapQuote: LiFiStrategyContext | undefined
    let destinationSwapQuote: LiFiStrategyContext | undefined
    let oftAmount = swapAmount

    // source swap
    if (steps.some((s) => s.type === 'sourceSwap')) {
      const usdtToken = this.createUSDTTokenData(tokenIn.chainId)
      const src = await this.liFiService.getQuote(tokenIn, usdtToken, swapAmount, id)
      sourceSwapQuote = src.context
      oftAmount = Number(formatUnits(BigInt(sourceSwapQuote.toAmount), 6))
    }

    // destination swap quote
    if (steps.some((s) => s.type === 'destinationSwap')) {
      const usdtToken = this.createUSDTTokenData(tokenOut.chainId)
      const dst = await this.liFiService.getQuote(usdtToken, tokenOut, oftAmount, id)
      destinationSwapQuote = dst.context
    }

    return {
      sourceSwapQuote,
      oftTransfer: {
        sourceChain: tokenIn.chainId,
        destinationChain: tokenOut.chainId,
        amount: parseUnits(oftAmount.toString(), 6),
      },
      destinationSwapQuote,
      steps: steps.map((s) => s.type),
      id,
    }
  }

  private calculateTotals(
    context: USDT0LiFiStrategyContext,
    initialAmount: number,
  ): { totalAmountOut: bigint; totalSlippage: number } {
    const totalSlippage = SlippageCalculator.calculateTotalSlippage(context)
    let amountOut = parseUnits(initialAmount.toString(), 6)
    if (context.sourceSwapQuote) amountOut = BigInt(context.sourceSwapQuote.toAmount)
    if (context.destinationSwapQuote) amountOut = BigInt(context.destinationSwapQuote.toAmount)
    return { totalAmountOut: amountOut, totalSlippage }
  }

  private createUSDTTokenData(chainId: number): TokenData {
    const cfg = this.ecoConfigService.getUSDT0()
    const chain = cfg.chains.find((c) => c.chainId === chainId)
    if (!chain) throw new Error(`USDT0 not configured for chain ${chainId}`)
    const usdt = (chain.underlyingToken ?? chain.token) as Hex
    return {
      chainId,
      config: {
        address: usdt,
        chainId,
        minBalance: 0,
        targetBalance: 0,
        type: 'erc20',
      },
      balance: {
        address: usdt,
        decimals: 6,
        balance: 0n,
      },
    } as any
  }

  private async executeSourceSwap(
    walletAddress: string,
    sourceSwapQuote: LiFiStrategyContext,
  ): Promise<Hex> {
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
        balance: 1000000000000000000n,
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
    const res = await this.liFiService.execute(walletAddress, quote as any)
    return this.extractTransactionHashFromLiFiResult(res, sourceSwapQuote.id)
  }

  private extractTransactionHashFromLiFiResult(lifiResult: any, id: string): Hex {
    if (lifiResult?.steps?.[0]?.execution?.process?.[0]?.txHash) {
      return lifiResult.steps[0].execution.process[0].txHash as Hex
    }
    if (lifiResult?.steps?.[0]?.execution?.process?.length > 0) {
      const processes = lifiResult.steps[0].execution.process
      const lastProcess = processes[processes.length - 1]
      if (lastProcess?.txHash) return lastProcess.txHash as Hex
    }
    if (lifiResult?.steps?.length > 0) {
      for (let i = lifiResult.steps.length - 1; i >= 0; i--) {
        const step = lifiResult.steps[i]
        if (step?.execution?.process?.length > 0) {
          const processes = step.execution.process
          const lastProcess = processes[processes.length - 1]
          if (lastProcess?.txHash) return lastProcess.txHash as Hex
        }
      }
    }
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'USDT0LiFi: Could not extract tx hash from LiFi result',
        id,
        properties: { resultStructure: Object.keys(lifiResult || {}) },
      }),
    )
    return '0x0' as Hex
  }

  private async buildUSDT0Quote(quote: RebalanceQuote<'USDT0LiFi'>) {
    // Reuse the USDT0 provider's quote shape; we only need amount/chain info
    const tokenIn = this.createUSDTTokenData(quote.tokenIn.chainId)
    const tokenOut = this.createUSDTTokenData(quote.tokenOut.chainId)
    return {
      amountIn: quote.context.oftTransfer.amount,
      amountOut: quote.context.oftTransfer.amount,
      slippage: 0,
      tokenIn,
      tokenOut,
      strategy: 'USDT0',
      context: {
        sourceChainId: tokenIn.chainId,
        sourceEid: this.ecoConfigService
          .getUSDT0()
          .chains.find((c) => c.chainId === tokenIn.chainId)!.eid,
        destinationEid: this.ecoConfigService
          .getUSDT0()
          .chains.find((c) => c.chainId === tokenOut.chainId)!.eid,
        to: tokenIn.balance.address,
        amountLD: quote.context.oftTransfer.amount,
      },
      groupID: quote.groupID,
      rebalanceJobID: quote.rebalanceJobID,
      id: quote.id,
    }
  }
}
