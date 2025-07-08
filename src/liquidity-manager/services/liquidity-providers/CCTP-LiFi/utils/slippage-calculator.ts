import { CCTPLiFiStrategyContext } from '@/liquidity-manager/types/types'

/**
 * Calculates the total slippage for a CCTPLiFi route
 * @param context The route context containing all steps
 * @returns Total slippage percentage (0-1)
 */
export function calculateTotalSlippage(context: CCTPLiFiStrategyContext): number {
  const amountIn =
    context.sourceSwapQuote?.fromAmount ??
    context.destinationSwapQuote?.fromAmount ??
    context.cctpTransfer.amount.toString()

  const amountOut =
    context.destinationSwapQuote?.toAmountMin ??
    context.sourceSwapQuote?.toAmountMin ??
    context.cctpTransfer.amount.toString()

  return 1 - parseFloat(amountOut) / parseFloat(amountIn)
}
