import { CCTPLiFiStrategyContext, LiFiStrategyContext } from '@/liquidity-manager/types/types'

export class SlippageCalculator {
  /**
   * Calculates the total slippage for a CCTPLiFi route
   * @param context The route context containing all steps
   * @returns Total slippage percentage (0-1)
   */
  static calculateTotalSlippage(context: CCTPLiFiStrategyContext): number {
    let totalSlippage = 0

    // Add slippage from source swap (if exists)
    if (context.sourceSwapQuote) {
      totalSlippage += this.getLiFiSlippage(context.sourceSwapQuote)
    }

    // CCTP has essentially 0 slippage (1:1 USDC transfer)
    // No slippage added for CCTP step

    // Add slippage from destination swap (if exists)
    if (context.destinationSwapQuote) {
      totalSlippage += this.getLiFiSlippage(context.destinationSwapQuote)
    }

    return totalSlippage
  }

  /**
   * Extracts slippage from a LiFi route
   * @param route LiFi route object
   * @returns Slippage percentage (0-1)
   */
  private static getLiFiSlippage(route: LiFiStrategyContext): number {
    // Calculate slippage as (expected - minimum) / expected
    const expected = parseFloat(route.toAmount)
    const minimum = parseFloat(route.toAmountMin)

    if (expected === 0) {
      return 0
    }

    return (expected - minimum) / expected
  }

  /**
   * Calculates the final amount out after applying slippage
   * @param initialAmount The initial amount before slippage
   * @param slippagePercentage The slippage percentage (0-1)
   * @returns Final amount after slippage
   */
  static applySlippage(initialAmount: bigint, slippagePercentage: number): bigint {
    const slippageBigInt = BigInt(Math.floor(slippagePercentage * 10000)) // Convert to basis points
    const remaining = 10000n - slippageBigInt
    return (initialAmount * remaining) / 10000n
  }

  /**
   * Validates that total slippage is within acceptable limits
   * @param totalSlippage Total slippage percentage (0-1)
   * @param maxSlippage Maximum acceptable slippage (0-1)
   * @returns True if slippage is acceptable
   */
  static validateSlippage(totalSlippage: number, maxSlippage: number): boolean {
    return totalSlippage <= maxSlippage
  }
}
