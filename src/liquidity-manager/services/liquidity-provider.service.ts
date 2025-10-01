import { Injectable, Logger } from '@nestjs/common'
import * as _ from 'lodash'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
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
import { USDT0LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/USDT0-LiFi/usdt0-lifi-provider.service'

@Injectable()
export class LiquidityProviderService {
  private logger = new Logger(LiquidityProviderService.name)
  private config: LiquidityManagerConfig

  constructor(
    protected readonly ecoConfigService: EcoConfigService,
    protected readonly liFiProviderService: LiFiProviderService,
    protected readonly cctpProviderService: CCTPProviderService,
    protected readonly crowdLiquidityService: CrowdLiquidityService,
    protected readonly warpRouteProviderService: WarpRouteProviderService,
    protected readonly relayProviderService: RelayProviderService,
    protected readonly stargateProviderService: StargateProviderService,
    protected readonly cctpLiFiProviderService: CCTPLiFiProviderService,
    protected readonly squidProviderService: SquidProviderService,
    protected readonly cctpv2ProviderService: CCTPV2ProviderService,
    protected readonly everclearProviderService: EverclearProviderService,
    protected readonly gatewayProviderService: GatewayProviderService,
    protected readonly usdt0ProviderService: USDT0ProviderService,
    protected readonly usdt0LiFiProviderService: USDT0LiFiProviderService,
    private readonly ecoAnalytics: EcoAnalyticsService,
    private readonly rejectionRepository: RebalanceQuoteRejectionRepository,
  ) {
    this.config = this.ecoConfigService.getLiquidityManager()
  }

  async getQuote(
    walletAddress: string,
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
  ): Promise<RebalanceQuote[]> {
    if (!Number.isFinite(swapAmount) || swapAmount <= 0) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: 'Skipping provider quote for zero/negative swapAmount',
          properties: {
            walletAddress,
            swapAmount,
            tokenIn: this.formatToken(tokenIn),
            tokenOut: this.formatToken(tokenOut),
          },
        }),
      )
      return []
    }
    const strategies = this.getWalletSupportedStrategies(walletAddress)
    const maxQuoteSlippage = this.ecoConfigService.getLiquidityManager().maxQuoteSlippage
    const quoteId = uuidv4()

    this.logger.log(
      EcoLogMessage.withId({
        message: 'Getting quote',
        properties: { walletAddress, tokenIn, tokenOut, swapAmount },
        id: quoteId,
      }),
    )

    // Track whether we had any quotes that were rejected due to slippage
    let hadQuotesButRejected = false
    // Track whether any strategy succeeded in getting quotes (before slippage check)
    let hadAnyQuotes = false

    // Iterate over strategies and return the first quote
    const quoteBatchRequests = strategies.map(async (strategy) => {
      try {
        const service = this.getStrategyService(strategy)
        this.logger.log(
          EcoLogMessage.withId({
            message: 'Getting quote for strategy',
            properties: { strategy, tokenIn, tokenOut, swapAmount },
            id: quoteId,
          }),
        )
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

          this.logger.warn(
            EcoLogMessage.withId({
              message: 'Quote rejected due to excessive slippage',
              properties: {
                strategy,
                maxQuoteSlippage,
                tokenIn: this.formatToken(tokenIn),
                tokenOut: this.formatToken(tokenOut),
                quotes: quotesArray.map((quote) => ({
                  slippage: quote.slippage,
                  amountIn: quote.amountIn.toString(),
                  amountOut: quote.amountOut.toString(),
                })),
              },
              id: quoteId,
            }),
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

        this.logger.error(
          EcoLogMessage.withErrorAndId({
            message: 'Unable to get quote from strategy',
            error,
            properties: { walletAddress, strategy, tokenIn, tokenOut, swapAmount },
            id: quoteId,
          }),
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

    this.logger.log(
      EcoLogMessage.withId({
        message: 'Quotes for route',
        properties: {
          walletAddress,
          tokenIn: this.formatToken(tokenIn),
          tokenOut: this.formatToken(tokenOut),
          bestQuote: this.formatQuoteBatch(bestQuotes),
          quoteBatches: quoteBatchResults.map((quoteBatch, index) => {
            const strategy = strategies[index]
            if (!quoteBatch) {
              return `Failed to get quote for strategy ${strategy}`
            }
            return {
              strategy,
              quotes: this.formatQuoteBatch(quoteBatch),
            }
          }),
        },
        id: quoteId,
      }),
    )

    this.logger.log(
      EcoLogMessage.withId({
        message: 'Best quote',
        properties: { bestQuote: this.formatQuoteBatch(bestQuotes) },
        id: quoteId,
      }),
    )

    return bestQuotes
  }

  async execute(walletAddress: string, quote: RebalanceQuote) {
    this.logger.log(
      EcoLogMessage.withId({
        message: 'Executing quote',
        properties: { quote },
        id: quote.id,
      }),
    )
    const service = this.getStrategyService(quote.strategy)
    return service.execute(walletAddress, quote)
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
      case 'USDT0LiFi':
        return this.usdt0LiFiProviderService as unknown as IRebalanceProvider<Strategy>
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
