import { CCTPLiFiStrategyContext } from '@/liquidity-manager/types/types'

export class SlippageCalculator {
  /**
   * Calculates the total slippage for a CCTPLiFi route
   * @param context The route context containing all steps
   * @returns Total slippage percentage (0-1)
   */
  static calculateTotalSlippage(context: CCTPLiFiStrategyContext): number {
    let totalSlippage = 0
    // CCTP has essentially 0 slippage (1:1 USDC transfer)
    // No slippage added for CCTP step
    if (context.sourceSwapQuote && !context.destinationSwapQuote) {
      totalSlippage =
        1 -
        parseFloat(context.sourceSwapQuote.toAmountMin) /
          parseFloat(context.sourceSwapQuote.fromAmount)
    } else if (context.sourceSwapQuote && context.destinationSwapQuote) {
      totalSlippage =
        1 -
        parseFloat(context.destinationSwapQuote.toAmountMin) /
          parseFloat(context.sourceSwapQuote.fromAmount)
    }
    return totalSlippage
  }
}
