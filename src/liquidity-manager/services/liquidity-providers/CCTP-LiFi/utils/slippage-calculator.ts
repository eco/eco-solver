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
    const toAmount = parseFloat(route.toAmount)
    const toAmountMin = parseFloat(route.toAmountMin)

    if (toAmount === 0) {
      return 0
    }

    // Calculate slippage as: 1 - (minimum output / expected output)
    // This represents the percentage difference between expected and minimum guaranteed output
    return 1 - toAmountMin / toAmount
  }
}
