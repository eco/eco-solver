import { Quote, Strategy, TokenData } from '@/liquidity-manager/types/types'

export interface IRebalanceProvider<S extends Strategy> {
  getQuote(tokenIn: TokenData, tokenOut: TokenData, swapAmount: number): Promise<Quote<S>>
  execute(walletAddress: string, quote: Quote<S>): Promise<unknown>
  getStrategy(): S
}
