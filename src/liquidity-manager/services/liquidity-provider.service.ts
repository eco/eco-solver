import { Injectable } from '@nestjs/common'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'

@Injectable()
export class LiquidityProviderService {
  constructor(protected readonly liFiProvider: LiFiProviderService) {}

  async getQuote(
    tokenIn: LiquidityManager.TokenData,
    tokenOut: LiquidityManager.TokenData,
    swapAmount: number,
  ): Promise<LiquidityManager.Quote> {
    return this.liFiProvider.getQuote(tokenIn, tokenOut, swapAmount)
  }

  async execute(quote: LiquidityManager.Quote) {
    switch (quote.strategy) {
      case 'LiFi':
        return this.liFiProvider.execute(quote)
      default:
        throw new Error(`Strategy not supported: ${quote.strategy}`)
    }
  }
}
