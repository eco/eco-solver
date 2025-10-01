import * as SlippageCalculator from './slippage-calculator'
import { CCTPLiFiStrategyContext } from '@/liquidity-manager/types/types'

describe('SlippageCalculator', () => {
  describe('calculateTotalSlippage', () => {
    it('should return 0 when there are no swaps', () => {
      const context: CCTPLiFiStrategyContext = {
        rebalance: {},
        cctpTransfer: { amount: 100n },
      } as unknown as CCTPLiFiStrategyContext
      expect(SlippageCalculator.calculateTotalSlippage(context)).toBe(0)
    })

    it('should calculate slippage correctly with only a source swap', () => {
      const context: CCTPLiFiStrategyContext = {
        rebalance: {},
        cctpTransfer: { amount: 1000n },
        sourceSwapQuote: {
          fromAmount: '1000',
          toAmountMin: '990',
        },
      } as unknown as CCTPLiFiStrategyContext
      // Slippage = 1 - (990 / 1000) = 0.01
      expect(SlippageCalculator.calculateTotalSlippage(context)).toBeCloseTo(0.01)
    })

    it('should calculate slippage correctly with both source and destination swaps', () => {
      const context: CCTPLiFiStrategyContext = {
        rebalance: {},
        cctpTransfer: { amount: 1000n },
        sourceSwapQuote: {
          fromAmount: '1000',
          toAmountMin: '990',
        },
        destinationSwapQuote: {
          fromAmount: '990',
          toAmountMin: '980.1',
        },
      } as unknown as CCTPLiFiStrategyContext
      // Total Slippage = 1 - (980.1 / 1000) = 0.0199
      expect(SlippageCalculator.calculateTotalSlippage(context)).toBeCloseTo(0.0199)
    })

    it('should calculate slippage correctly with only a destination swap', () => {
      const context: CCTPLiFiStrategyContext = {
        rebalance: {},
        cctpTransfer: { amount: 1000n },
        destinationSwapQuote: {
          fromAmount: '1000',
          toAmountMin: '950',
        },
      } as unknown as CCTPLiFiStrategyContext
      // Slippage = 1 - (950 / 1000) = 0.05
      expect(SlippageCalculator.calculateTotalSlippage(context)).toBeCloseTo(0.05)
    })

    it('should ignore malformed/zero inputs gracefully', () => {
      const context: CCTPLiFiStrategyContext = {
        rebalance: {},
        cctpTransfer: { amount: 1000n },
        sourceSwapQuote: {
          fromAmount: '0',
          toAmountMin: '0',
        },
        destinationSwapQuote: {
          fromAmount: 'abc',
          toAmountMin: 'def',
        },
      } as unknown as CCTPLiFiStrategyContext
      expect(SlippageCalculator.calculateTotalSlippage(context)).toBe(0)
    })
  })
})
