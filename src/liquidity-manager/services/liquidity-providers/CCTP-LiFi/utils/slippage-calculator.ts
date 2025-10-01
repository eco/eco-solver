import { CCTPLiFiStrategyContext } from '@/liquidity-manager/types/types'

/**
 * Calculates the total slippage for a CCTPLiFi route
 * @param context The route context containing all steps
 * @returns Total slippage percentage (0-1)
 */
export function calculateTotalSlippage(context: CCTPLiFiStrategyContext): number {
  const stepSlip = (from?: string, toMin?: string) => {
    if (!from || !toMin) return 0
    const f = parseFloat(from)
    const t = parseFloat(toMin)
    if (!isFinite(f) || f === 0) return 0
    return 1 - t / f
  }

  const s1 = stepSlip(context.sourceSwapQuote?.fromAmount, context.sourceSwapQuote?.toAmountMin)
  const s2 = stepSlip(
    context.destinationSwapQuote?.fromAmount,
    context.destinationSwapQuote?.toAmountMin,
  )

  return 1 - (1 - s1) * (1 - s2)
}
