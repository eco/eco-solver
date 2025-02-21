import { Injectable, Logger } from '@nestjs/common'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { Quote, Strategy, TokenData } from '@/liquidity-manager/types/types'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { CCTPProviderService } from '@/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'

@Injectable()
export class LiquidityProviderService {
  private logger = new Logger(LiquidityProviderService.name)

  constructor(
    protected readonly liFiProviderService: LiFiProviderService,
    protected readonly cctpProviderService: CCTPProviderService,
    protected readonly crowdLiquidityService: CrowdLiquidityService,
  ) {}

  async getQuote(
    walletAddress: string,
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
  ): Promise<Quote> {
    const strategies = this.getWalletSupportedStrategies(walletAddress)

    // Iterate over strategies and return the first quote
    for (const strategy of strategies) {
      try {
        const service = this.getStrategyService(strategy)
        return await service.getQuote(tokenIn, tokenOut, swapAmount)
      } catch (error) {
        this.logger.error(
          EcoLogMessage.withError({
            message: 'Unable to get quote from strategy',
            error,
            properties: { walletAddress, strategy, tokenIn, tokenOut, swapAmount },
          }),
        )
      }
    }

    throw new Error('Unable to get quote for route')
  }

  async execute(walletAddress: string, quote: Quote) {
    const service = this.getStrategyService(quote.strategy)
    return service.execute(walletAddress, quote)
  }

  private getStrategyService(strategy: Strategy): IRebalanceProvider<Strategy> {
    if (strategy === 'LiFi') {
      return this.liFiProviderService
    } else if (strategy === 'CCTP') {
      return this.cctpProviderService
    } else {
      throw new Error(`Strategy not supported: ${strategy}`)
    }
  }

  private getWalletSupportedStrategies(walletAddress: string): Strategy[] {
    const crowdLiquidityPoolAddress = this.crowdLiquidityService.getPoolAddress()

    switch (walletAddress) {
      case crowdLiquidityPoolAddress:
        return ['CCTP']
      default:
        return ['LiFi', 'CCTP']
    }
  }
}
