import { Injectable, Logger } from '@nestjs/common'
import * as _ from 'lodash'
import { EcoLogMessage } from '@eco-solver/common/logging/eco-log-message'
import { CrowdLiquidityService } from '@eco-solver/intent/crowd-liquidity.service'
import { RebalanceQuote, Strategy, TokenData } from '@eco-solver/liquidity-manager/types/types'
import { IRebalanceProvider } from '@eco-solver/liquidity-manager/interfaces/IRebalanceProvider'
import { LiFiProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { CCTPProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service'
import { WarpRouteProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/Hyperlane/warp-route-provider.service'
import { EcoConfigService } from '@libs/solver-config'
import { getTotalSlippage } from '@eco-solver/liquidity-manager/utils/math'
import { RelayProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/Relay/relay-provider.service'
import { StargateProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/Stargate/stargate-provider.service'
import { CCTPLiFiProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/CCTP-LiFi/cctp-lifi-provider.service'
import { LiquidityManagerConfig } from '@libs/solver-config'
import { v4 as uuidv4 } from 'uuid'
import { EcoAnalyticsService } from '@eco-solver/analytics/eco-analytics.service'
import { ANALYTICS_EVENTS } from '@eco-solver/analytics/events.constants'
import { SquidProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/Squid/squid-provider.service'
import { CCTPV2ProviderService } from './liquidity-providers/CCTP-V2/cctpv2-provider.service'
import { EverclearProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/Everclear/everclear-provider.service'

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
    private readonly ecoAnalytics: EcoAnalyticsService,
    protected readonly squidProviderService: SquidProviderService,
    protected readonly cctpv2ProviderService: CCTPV2ProviderService,
    protected readonly everclearProviderService: EverclearProviderService,
  ) {
    this.config = this.ecoConfigService.getLiquidityManager()
  }

  async getQuote(
    walletAddress: string,
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
  ): Promise<RebalanceQuote[]> {
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

        const totalSlippage = getTotalSlippage(_.map(quotesArray, 'slippage'))
        if (totalSlippage > maxQuoteSlippage) {
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

        return undefined
      }
    })

    const quoteBatchResults = await Promise.all(quoteBatchRequests)

    // Filter out undefined results
    const validQuoteBatches = quoteBatchResults.filter((batch) => batch !== undefined)

    // Use the quote from the strategy returning the biggest amount out
    const bestQuote = validQuoteBatches.reduce((bestBatch, quoteBatch) => {
      if (!bestBatch) return quoteBatch
      if (!quoteBatch) return bestBatch

      const bestQuote = bestBatch[quoteBatch.length - 1]
      const quote = quoteBatch[quoteBatch.length - 1]

      return (bestQuote?.amountOut ?? 0n) >= (quote?.amountOut ?? 0n) ? bestBatch : quoteBatch
    }, validQuoteBatches[0])

    if (!bestQuote) {
      throw new Error('Unable to get quote for route')
    }

    this.logger.log(
      EcoLogMessage.withId({
        message: 'Quotes for route',
        properties: {
          walletAddress,
          tokenIn: this.formatToken(tokenIn),
          tokenOut: this.formatToken(tokenOut),
          bestQuote: this.formatQuoteBatch(bestQuote),
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
        properties: { bestQuote: this.formatQuoteBatch(bestQuote) },
        id: quoteId,
      }),
    )

    return bestQuote
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

  /**
   * Attempts a route using fallback mechanisms (like core tokens)
   * @param tokenIn The source token
   * @param tokenOut The destination token
   * @param swapAmount The amount to swap
   * @returns A quote using the fallback mechanism
   */
  async fallback(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
  ): Promise<RebalanceQuote[]> {
    const quotes = await this.liFiProviderService.fallback(tokenIn, tokenOut, swapAmount)
    const maxQuoteSlippage = this.ecoConfigService.getLiquidityManager().maxQuoteSlippage

    const slippage = getTotalSlippage(_.map(quotes, 'slippage'))

    if (slippage > maxQuoteSlippage) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Fallback quote rejected due to excessive slippage',
          properties: {
            slippage: slippage,
            maxQuoteSlippage,
            quotes: quotes.map((quote) => ({
              tokenIn: this.formatToken(tokenIn),
              tokenOut: this.formatToken(tokenOut),
              amountIn: quote.amountIn.toString(),
              amountOut: quote.amountOut.toString(),
            })),
          },
        }),
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
