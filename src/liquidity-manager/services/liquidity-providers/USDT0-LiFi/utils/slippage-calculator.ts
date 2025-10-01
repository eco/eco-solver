import { USDT0LiFiStrategyContext } from '@/liquidity-manager/types/types'

export function calculateTotalSlippage(context: USDT0LiFiStrategyContext): number {
  const amountIn =
    context.sourceSwapQuote?.fromAmount ??
    context.destinationSwapQuote?.fromAmount ??
    context.oftTransfer.amount.toString()

  const amountOut =
    context.destinationSwapQuote?.toAmountMin ??
    context.sourceSwapQuote?.toAmountMin ??
    context.oftTransfer.amount.toString()

  return 1 - parseFloat(amountOut) / parseFloat(amountIn)
}
