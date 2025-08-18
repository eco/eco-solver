import { RebalanceQuote, Strategy, TokenData } from '@eco-solver/liquidity-manager/types/types'

export interface IRebalanceProvider<S extends Strategy> {
  getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    id?: string,
  ): Promise<RebalanceQuote | RebalanceQuote[]>
  execute(walletAddress: string, quote: RebalanceQuote<S>): Promise<unknown>
  getStrategy(): S
}
