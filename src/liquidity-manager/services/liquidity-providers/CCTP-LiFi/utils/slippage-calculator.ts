import { CCTPLiFiStrategyContext } from '@/liquidity-manager/types/types'

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
      totalSlippage +=
        1 -
        parseFloat(context.sourceSwapQuote.toAmount) /
          parseFloat(context.sourceSwapQuote.fromAmount)
    }

    // CCTP has essentially 0 slippage (1:1 USDC transfer)
    // No slippage added for CCTP step

    // Add slippage from destination swap (if exists)
    if (context.destinationSwapQuote) {
      totalSlippage +=
        1 -
        parseFloat(context.destinationSwapQuote.toAmount) /
          parseFloat(context.destinationSwapQuote.fromAmount)
    }

    return totalSlippage
  }
}
