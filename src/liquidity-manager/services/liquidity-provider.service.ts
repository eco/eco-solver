import { Injectable, Logger } from '@nestjs/common'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { RebalanceQuote, Strategy, TokenData } from '@/liquidity-manager/types/types'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { CCTPProviderService } from '@/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service'
import { WarpRouteProviderService } from '@/liquidity-manager/services/liquidity-providers/Hyperlane/warp-route-provider.service'

@Injectable()
export class LiquidityProviderService {
  private logger = new Logger(LiquidityProviderService.name)

  constructor(
    protected readonly liFiProviderService: LiFiProviderService,
    protected readonly cctpProviderService: CCTPProviderService,
    protected readonly crowdLiquidityService: CrowdLiquidityService,
    protected readonly warpRouteProviderService: WarpRouteProviderService,
  ) {}

  async getQuote(
    walletAddress: string,
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
  ): Promise<RebalanceQuote[]> {
    const strategies = this.getWalletSupportedStrategies(walletAddress)

    // Iterate over strategies and return the first quote
    const quoteBatchRequests = strategies.map(async (strategy) => {
      try {
        const service = this.getStrategyService(strategy)
        const quotes = await service.getQuote(tokenIn, tokenOut, swapAmount)
        return Array.isArray(quotes) ? quotes : [quotes]
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

    // Use the quote from the strategy returning the biggest amount out
    const bestQuote = quoteBatchResults.reduce((bestBatch, quoteBatch) => {
      if (!bestBatch) return quoteBatch
      if (!quoteBatch) return bestBatch

      const bestQuote = bestBatch[quoteBatch.length - 1]
      const quote = quoteBatch[quoteBatch.length - 1]

      return bestQuote.amountOut >= quote.amountOut ? bestBatch : quoteBatch
    }, quoteBatchResults[0])

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

  private getStrategyService(strategy: Strategy): IRebalanceProvider<Strategy> {
    switch (strategy) {
      case 'LiFi':
        return this.liFiProviderService
      case 'CCTP':
        return this.cctpProviderService
      case 'WarpRoute':
        return this.warpRouteProviderService
    }
    throw new Error(`Strategy not supported: ${strategy}`)
  }

  private getWalletSupportedStrategies(walletAddress: string): Strategy[] {
    const crowdLiquidityPoolAddress = this.crowdLiquidityService.getPoolAddress()

    switch (walletAddress) {
      case crowdLiquidityPoolAddress:
        return ['CCTP']
      default:
        return ['LiFi', 'CCTP', 'WarpRoute']
    }
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
      }
    })
  }
}
