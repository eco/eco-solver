import { Injectable, Inject, forwardRef } from '@nestjs/common'
import * as _ from 'lodash'
import { LiquidityManagerLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { RebalanceQuote, Strategy, TokenData } from '@/liquidity-manager/types/types'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { CCTPProviderService } from '@/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service'
import { WarpRouteProviderService } from '@/liquidity-manager/services/liquidity-providers/Hyperlane/warp-route-provider.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { getTotalSlippage } from '@/liquidity-manager/utils/math'
import { RelayProviderService } from '@/liquidity-manager/services/liquidity-providers/Relay/relay-provider.service'
import { StargateProviderService } from '@/liquidity-manager/services/liquidity-providers/Stargate/stargate-provider.service'
import { CCTPLiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/CCTP-LiFi/cctp-lifi-provider.service'
import { LiquidityManagerConfig } from '@/eco-configs/eco-config.types'
import { v4 as uuidv4 } from 'uuid'
import { EcoAnalyticsService } from '@/analytics/eco-analytics.service'
import { ANALYTICS_EVENTS } from '@/analytics/events.constants'
import { SquidProviderService } from '@/liquidity-manager/services/liquidity-providers/Squid/squid-provider.service'
import { CCTPV2ProviderService } from './liquidity-providers/CCTP-V2/cctpv2-provider.service'
import { EverclearProviderService } from '@/liquidity-manager/services/liquidity-providers/Everclear/everclear-provider.service'
import { GatewayProviderService } from '@/liquidity-manager/services/liquidity-providers/Gateway/gateway-provider.service'
import { RebalanceQuoteRejectionRepository } from '@/liquidity-manager/repositories/rebalance-quote-rejection.repository'
import { RebalanceTokenModel } from '@/liquidity-manager/schemas/rebalance-token.schema'
import { RejectionReason } from '@/liquidity-manager/schemas/rebalance-quote-rejection.schema'
import { USDT0ProviderService } from '@/liquidity-manager/services/liquidity-providers/USDT0/usdt0-provider.service'

@Injectable()
export class LiquidityProviderService {
  private logger = new LiquidityManagerLogger('LiquidityProviderService')
  private config: LiquidityManagerConfig

  constructor(
    protected readonly ecoConfigService: EcoConfigService,
    protected readonly liFiProviderService: LiFiProviderService,
    protected readonly cctpProviderService: CCTPProviderService,
    protected readonly crowdLiquidityService: CrowdLiquidityService,
    protected readonly warpRouteProviderService: WarpRouteProviderService,
    protected readonly relayProviderService: RelayProviderService,
    protected readonly stargateProviderService: StargateProviderService,
    @Inject(forwardRef(() => CCTPLiFiProviderService))
    protected readonly cctpLiFiProviderService: CCTPLiFiProviderService,
    protected readonly squidProviderService: SquidProviderService,
    protected readonly cctpv2ProviderService: CCTPV2ProviderService,
    protected readonly everclearProviderService: EverclearProviderService,
    protected readonly gatewayProviderService: GatewayProviderService,
    protected readonly usdt0ProviderService: USDT0ProviderService,
    private readonly ecoAnalytics: EcoAnalyticsService,
    private readonly rejectionRepository: RebalanceQuoteRejectionRepository,
  ) {
    this.config = this.ecoConfigService.getLiquidityManager()
  }

  @LogOperation('quote_generation', LiquidityManagerLogger, {
    sampling: { rate: 0.1, level: 'debug' }, // Sample high-volume quote operations
  })
  async getQuote(
    @LogContext walletAddress: string,
    @LogContext tokenIn: TokenData,
    @LogContext tokenOut: TokenData,
    @LogContext swapAmount: number,
  ): Promise<RebalanceQuote[]> {
    if (!Number.isFinite(swapAmount) || swapAmount <= 0) {
      this.logger.warn(
        {
          rebalanceId: 'provider_quote',
          walletAddress,
          strategy: 'liquidity_provider',
        },
        'Skipping provider quote for zero/negative swapAmount',
        {
          swap_amount: swapAmount,
          token_in: this.formatToken(tokenIn),
          token_out: this.formatToken(tokenOut),
        },
      )
      return []
    }
    const strategies = this.getWalletSupportedStrategies(walletAddress)
    const maxQuoteSlippage = this.ecoConfigService.getLiquidityManager().maxQuoteSlippage
    const quoteId = uuidv4()

    // Track whether we had any quotes that were rejected due to slippage
    let hadQuotesButRejected = false
    // Track whether any strategy succeeded in getting quotes (before slippage check)
    let hadAnyQuotes = false

    // Iterate over strategies and return the first quote
    const quoteBatchRequests = strategies.map(async (strategy) => {
      try {
        const service = this.getStrategyService(strategy)
        const quotes = await service.getQuote(tokenIn, tokenOut, swapAmount, quoteId)
        const quotesArray = Array.isArray(quotes) ? quotes : [quotes]
        hadAnyQuotes = true // Mark that at least one strategy succeeded in getting quotes

        const totalSlippage = getTotalSlippage(_.map(quotesArray, 'slippage'))
        if (totalSlippage > maxQuoteSlippage) {
          hadQuotesButRejected = true

          // Persist rejection for analytics (non-blocking)
          this.rejectionRepository.create({
            rebalanceId: quoteId,
            strategy,
            reason: RejectionReason.HIGH_SLIPPAGE,
            tokenIn: RebalanceTokenModel.fromTokenData(tokenIn),
            tokenOut: RebalanceTokenModel.fromTokenData(tokenOut),
            swapAmount,
            details: {
              slippage: totalSlippage,
              maxQuoteSlippage,
              quotes: quotesArray.map((quote) => ({
                slippage: quote.slippage,
                amountIn: quote.amountIn.toString(),
                amountOut: quote.amountOut.toString(),
              })),
            },
            walletAddress,
          })

          this.logger.logQuoteRejection(
            {
              rebalanceId: quoteId,
              walletAddress,
              strategy,
              tokenInAddress: tokenIn.config.address,
              tokenOutAddress: tokenOut.config.address,
              sourceChainId: tokenIn.config.chainId,
              destinationChainId: tokenOut.config.chainId,
            },
            RejectionReason.HIGH_SLIPPAGE,
            {
              maxQuoteSlippage,
              quotes: quotesArray.map((quote) => ({
                slippage: quote.slippage,
                amountIn: quote.amountIn.toString(),
                amountOut: quote.amountOut.toString(),
              })),
            },
          )

          return undefined
        }

        return quotesArray.length > 0 ? quotesArray : undefined
      } catch (error) {
        // Persist rejection for analytics (non-blocking)
        this.rejectionRepository.create({
          rebalanceId: quoteId,
          strategy,
          reason: RejectionReason.PROVIDER_ERROR,
          tokenIn: RebalanceTokenModel.fromTokenData(tokenIn),
          tokenOut: RebalanceTokenModel.fromTokenData(tokenOut),
          swapAmount,
          details: {
            error: error.message,
            code: error.code,
            stack: error.stack,
            operation: 'strategy_quote',
          },
          walletAddress,
        })

        this.ecoAnalytics.trackError(
          ANALYTICS_EVENTS.LIQUIDITY_MANAGER.STRATEGY_QUOTE_ERROR,
          error,
          {
            walletAddress,
            strategy,
            tokenIn: this.formatToken(tokenIn),
            tokenOut: this.formatToken(tokenOut),
            swapAmount,
            operation: 'strategy_quote',
            service: this.constructor.name,
          },
        )
      }
    })

    const quoteBatchResults = await Promise.all(quoteBatchRequests)

    // Filter out undefined results
    const validQuoteBatches = quoteBatchResults.filter((batch) => batch !== undefined)

    // Use the quote from the strategy returning the biggest amount out
    const bestQuotes = validQuoteBatches.reduce((bestBatch, quoteBatch) => {
      if (!bestBatch) return quoteBatch
      if (!quoteBatch) return bestBatch

      const bestQuote = bestBatch[quoteBatch.length - 1]
      const quote = quoteBatch[quoteBatch.length - 1]

      return (bestQuote?.amountOut ?? 0n) >= (quote?.amountOut ?? 0n) ? bestBatch : quoteBatch
    }, validQuoteBatches[0])

    if (!bestQuotes) {
      if (hadAnyQuotes || hadQuotesButRejected) {
        // Return empty array when:
        // 1. Quotes were found but rejected due to slippage, OR
        // 2. Some strategies succeeded but no valid quotes remained (mixed success/failure)
        return []
      } else {
        // Throw error when no quotes were found at all (all strategies failed)
        throw new Error('Unable to get quote for route')
      }
    }

    return bestQuotes
  }

  @LogOperation('quote_execution', LiquidityManagerLogger)
  async execute(@LogContext walletAddress: string, @LogContext quote: RebalanceQuote) {
    const service = this.getStrategyService(quote.strategy)
    return service.execute(walletAddress, quote)
  }

  /**
   * Attempts a route using fallback mechanisms (like core tokens)
   * @param tokenIn The source token
   * @param tokenOut The destination token
   * @param swapAmount The amount to swap
   * @param quoteId Optional quote ID for tracking (fallback to generated UUID)
   * @param walletAddress Optional wallet address for analytics
   * @returns A quote using the fallback mechanism
   */
  @LogOperation('fallback_quote_generation', LiquidityManagerLogger)
  async fallback(
    @LogContext tokenIn: TokenData,
    @LogContext tokenOut: TokenData,
    @LogContext swapAmount: number,
    @LogContext quoteId?: string,
    @LogContext walletAddress?: string,
  ): Promise<RebalanceQuote[]> {
    const fallbackQuoteId = quoteId || uuidv4()
    const quotes = await this.liFiProviderService.fallback(tokenIn, tokenOut, swapAmount)
    const maxQuoteSlippage = this.ecoConfigService.getLiquidityManager().maxQuoteSlippage

    const slippage = getTotalSlippage(_.map(quotes, 'slippage'))

    if (slippage > maxQuoteSlippage) {
      // Persist fallback rejection for analytics (non-blocking)
      this.rejectionRepository.create({
        rebalanceId: fallbackQuoteId,
        strategy: 'LiFi', // Fallback uses LiFi service
        reason: RejectionReason.HIGH_SLIPPAGE,
        tokenIn: RebalanceTokenModel.fromTokenData(tokenIn),
        tokenOut: RebalanceTokenModel.fromTokenData(tokenOut),
        swapAmount,
        details: {
          slippage,
          maxQuoteSlippage,
          fallback: true,
          quotes: quotes.map((quote) => ({
            slippage: quote.slippage,
            amountIn: quote.amountIn.toString(),
            amountOut: quote.amountOut.toString(),
          })),
        },
        walletAddress,
      })

      this.logger.logQuoteRejection(
        {
          rebalanceId: fallbackQuoteId,
          walletAddress: walletAddress || 'unknown',
          strategy: 'LiFi',
          sourceChainId: tokenIn.config.chainId,
          destinationChainId: tokenOut.config.chainId,
          tokenInAddress: tokenIn.config.address,
          tokenOutAddress: tokenOut.config.address,
        },
        RejectionReason.HIGH_SLIPPAGE,
        {
          slippage,
          maxQuoteSlippage,
          fallback: true,
          quotes: quotes.map((quote) => ({
            tokenIn: this.formatToken(tokenIn),
            tokenOut: this.formatToken(tokenOut),
            amountIn: quote.amountIn.toString(),
            amountOut: quote.amountOut.toString(),
          })),
        },
      )
      throw new Error(
        `Fallback quote slippage ${slippage} exceeds maximum allowed ${maxQuoteSlippage}`,
      )
    }

    return quotes
  }

  private getStrategyService(strategy: Strategy): IRebalanceProvider<Strategy> {
    switch (strategy) {
      case 'LiFi':
        return this.liFiProviderService
      case 'CCTP':
        return this.cctpProviderService
      case 'WarpRoute':
        return this.warpRouteProviderService
      case 'Relay':
        return this.relayProviderService
      case 'Stargate':
        return this.stargateProviderService
      case 'CCTPLiFi':
        return this.cctpLiFiProviderService
      case 'Squid':
        return this.squidProviderService
      case 'CCTPV2':
        return this.cctpv2ProviderService
      case 'Everclear':
        return this.everclearProviderService
      case 'Gateway':
        return this.gatewayProviderService
      case 'USDT0':
        return this.usdt0ProviderService
    }
    throw new Error(`Strategy not supported: ${strategy}`)
  }

  private getWalletSupportedStrategies(walletAddress: string): Strategy[] {
    const crowdLiquidityPoolAddress = this.crowdLiquidityService.getPoolAddress()

    const walletType =
      walletAddress === crowdLiquidityPoolAddress ? 'crowd-liquidity-pool' : 'eco-wallet'

    const strategies = this.config.walletStrategies[walletType]

    if (!strategies || strategies.length === 0) {
      throw new Error(`No strategies configured for wallet type: ${walletType}`)
    }

    return strategies
  }

  private formatToken(token: TokenData) {
    return { chainId: token.chainId, token: token.config.address }
  }

  private formatQuoteBatch(quoteBatch: RebalanceQuote[]) {
    return quoteBatch.map((quote) => {
      return {
        strategy: quote.strategy,
        tokenIn: this.formatToken(quote.tokenIn),
        tokenOut: this.formatToken(quote.tokenOut),
        amountIn: quote.amountIn.toString(),
        amountOut: quote.amountOut.toString(),
        slippage: quote.slippage,
      }
    })
  }
}
