import { RebalanceQuote, Strategy, TokenData } from '@/liquidity-manager/types/types'

/**
 * Interface for liquidity rebalance providers that handle swapping tokens across different strategies
 */
export interface IRebalanceProvider<S extends Strategy> {
  /**
   * Gets a quote for swapping tokens
   * @param tokenIn - The input token data including address, decimals, and chain information
   * @param tokenOut - The output token data including address, decimals, and chain information
   * @param swapAmountBased - The amount to swap that has already been normalized to the base token's decimals
   *                          using {@link normalizeBalanceToBase} with {@link BASE_DECIMALS} (18 decimals).
   *                          This represents the tokenIn amount and is ready for direct use in swap calculations.
   * @param id - Optional identifier for tracking the quote request
   * @returns A promise resolving to a single quote or array of quotes
   */
  getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmountBased: bigint,
    id?: string,
  ): Promise<RebalanceQuote | RebalanceQuote[]>

  /**
   * Executes a rebalance swap using the provided quote
   * @param walletAddress - The wallet address to execute the swap from
   * @param quote - The rebalance quote containing swap parameters and strategy details
   * @returns A promise resolving to the execution result
   */
  execute(walletAddress: string, quote: RebalanceQuote<S>): Promise<unknown>

  /**
   * Gets the strategy type this provider implements
   * @returns The strategy enum value
   */
  getStrategy(): S
}
