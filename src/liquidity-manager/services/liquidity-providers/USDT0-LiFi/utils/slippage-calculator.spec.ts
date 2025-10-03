import * as SlippageCalculator from './slippage-calculator'
import { USDT0LiFiStrategyContext } from '@/liquidity-manager/types/types'

describe('USDT0-LiFi SlippageCalculator', () => {
  describe('calculateTotalSlippage', () => {
    it('returns 0 when there are no swaps', () => {
      const ctx = {
        oftTransfer: { amount: 1000n },
      } as unknown as USDT0LiFiStrategyContext
      expect(SlippageCalculator.calculateTotalSlippage(ctx)).toBe(0)
    })

    it('calculates slippage with only source swap', () => {
      const ctx = {
        oftTransfer: { amount: 1000n },
        sourceSwapQuote: {
          fromAmount: '100000000',
          toAmountMin: '99000000',
        },
      } as unknown as USDT0LiFiStrategyContext
      // 1%
      expect(SlippageCalculator.calculateTotalSlippage(ctx)).toBeCloseTo(0.01)
    })

    it('calculates slippage with only destination swap', () => {
      const ctx = {
        oftTransfer: { amount: 1000n },
        destinationSwapQuote: {
          fromAmount: '100000000',
          toAmountMin: '95000000',
        },
      } as unknown as USDT0LiFiStrategyContext
      // 5%
      expect(SlippageCalculator.calculateTotalSlippage(ctx)).toBeCloseTo(0.05)
    })

    it('combines source and destination slippages multiplicatively', () => {
      const ctx = {
        oftTransfer: { amount: 1000n },
        sourceSwapQuote: {
          fromAmount: '100000000',
          toAmountMin: '99000000', // 1%
        },
        destinationSwapQuote: {
          fromAmount: '99000000',
          toAmountMin: '98010000', // 1% on the reduced base
        },
      } as unknown as USDT0LiFiStrategyContext
      // 1 - (1-0.01)*(1-0.01) = 0.0199
      expect(SlippageCalculator.calculateTotalSlippage(ctx)).toBeCloseTo(0.0199)
    })

    it('ignores malformed/zero inputs gracefully', () => {
      const ctx = {
        oftTransfer: { amount: 1000n },
        sourceSwapQuote: {
          fromAmount: '0',
          toAmountMin: '0',
        },
        destinationSwapQuote: {
          fromAmount: 'abc',
          toAmountMin: 'def',
        },
      } as unknown as USDT0LiFiStrategyContext
      expect(SlippageCalculator.calculateTotalSlippage(ctx)).toBe(0)
    })
  })
})
