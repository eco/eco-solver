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

    // Iterate over strategies and return the first quote
    const quoteBatchRequests = strategies.map(async (strategy) => {
      try {
        const service = this.getStrategyService(strategy)
        const id = uuidv4()
        const quotes = await service.getQuote(tokenIn, tokenOut, swapAmount, id)
        const quotesArray = Array.isArray(quotes) ? quotes : [quotes]

        // Helper function to check if a quote is valid
        const isQuoteValid = (quote: RebalanceQuote): boolean => quote.slippage <= maxQuoteSlippage

        // Filter out quotes that exceed maximum slippage
        const validQuotes = quotesArray.filter(isQuoteValid)
        const rejectedQuotes = quotesArray.filter((quote) => !isQuoteValid(quote))

        // Log rejected quotes
        rejectedQuotes.forEach((quote) => {
          this.logger.warn(
            EcoLogMessage.fromDefault({
              message: 'Quote rejected due to excessive slippage',
              properties: {
                strategy,
                slippage: quote.slippage,
                maxQuoteSlippage,
                tokenIn: this.formatToken(tokenIn),
                tokenOut: this.formatToken(tokenOut),
                amountIn: quote.amountIn.toString(),
                amountOut: quote.amountOut.toString(),
              },
            }),
          )
        })

        return validQuotes.length > 0 ? validQuotes : undefined
      } catch (error) {
        this.logger.error(
          EcoLogMessage.withError({
            message: 'Unable to get quote from strategy',
            error,
            properties: { walletAddress, strategy, tokenIn, tokenOut, swapAmount },
          }),
        )
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
      EcoLogMessage.fromDefault({
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
      }),
    )

    return bestQuote
  }

  async execute(walletAddress: string, quote: RebalanceQuote) {
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
