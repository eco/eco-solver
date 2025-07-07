import { getSlippageRange, getTotalSlippage } from './math'

describe('math utils', () => {
  describe('getSlippageRange', () => {
    it('should calculate correct slippage range', () => {
      const amount = 1000n
      const slippage = 0.01 // 1%

      const result = getSlippageRange(amount, slippage)

      expect(result.min).toBe(990n)
      expect(result.max).toBe(1010n)
    })

    it('should handle zero slippage', () => {
      const amount = 1000n
      const slippage = 0

      const result = getSlippageRange(amount, slippage)

      expect(result.min).toBe(1000n)
      expect(result.max).toBe(1000n)
    })
  })

  describe('getTotalSlippage', () => {
    it('should return 0 for empty array', () => {
      expect(getTotalSlippage([])).toBe(0)
    })

    it('should return the same value for single slippage', () => {
      expect(getTotalSlippage([0.01])).toBeCloseTo(0.01, 10)
    })

    it('should calculate compound slippage for multiple values', () => {
      // Two 1% slippages compound to: 1 - (0.99 * 0.99) = 0.0199
      const result = getTotalSlippage([0.01, 0.01])
      expect(result).toBeCloseTo(0.0199, 6)
    })

    it('should handle multiple different slippages', () => {
      // 1%, 2%, 1.5% compound to: 1 - (0.99 * 0.98 * 0.985) = 0.044353
      const result = getTotalSlippage([0.01, 0.02, 0.015])
      expect(result).toBeCloseTo(0.044353, 5)
    })

    it('should handle the example from the comment', () => {
      // Example from the function comment
      const result = getTotalSlippage([0.01, 0.02, 0.015])
      expect(result).toBeCloseTo(0.0443, 3)
    })

    it('should handle zero slippages', () => {
      const result = getTotalSlippage([0, 0, 0])
      expect(result).toBe(0)
    })

    it('should handle mixed zero and non-zero slippages', () => {
      // 0%, 2%, 0% compound to just 2%
      const result = getTotalSlippage([0, 0.02, 0])
      expect(result).toBeCloseTo(0.02, 10)
    })

    it('should handle very small slippages', () => {
      const result = getTotalSlippage([0.0001, 0.0001, 0.0001])
      // Should be approximately 0.00029997
      expect(result).toBeCloseTo(0.00029997, 6)
    })

    it('should handle edge case with slippage values close to maximum', () => {
      // Two 0.25% slippages
      const result = getTotalSlippage([0.0025, 0.0025])
      // 1 - (0.9975 * 0.9975) = 0.00499375
      expect(result).toBeCloseTo(0.00499375, 8)
    })

    it('should handle case that slightly exceeds typical limit', () => {
      // Two 0.3% slippages
      const result = getTotalSlippage([0.003, 0.003])
      // 1 - (0.997 * 0.997) = 0.005991
      expect(result).toBeCloseTo(0.005991, 6)
    })
  })
})
