import { Injectable } from '@nestjs/common'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'

@Injectable()
export class LiquidityProviderService {
  constructor(public readonly liFiProvider: LiFiProviderService) {}

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
  ): Promise<RebalanceQuote> {
    return this.liFiProvider.getQuote(tokenIn, tokenOut, swapAmount)
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
  ): Promise<RebalanceQuote> {
    return this.liFiProvider.fallback(tokenIn, tokenOut, swapAmount)
  }

  async execute(quote: RebalanceQuote) {
    switch (quote.strategy) {
      case 'LiFi':
        return this.liFiProvider.execute(quote)
      default:
        throw new Error(`Strategy not supported: ${quote.strategy}`)
    }
  }
}
