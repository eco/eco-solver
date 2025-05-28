import { normalizeBalance, compareNormalizedTotals } from '@/fee/utils'

describe('Utils Tests', () => {
  describe('normalizeBalance', () => {
    it('should throw if decimals are not integers', () => {
      expect(() => normalizeBalance({ balance: 1n, decimal: 1.5 }, 1)).toThrow(
        new Error('Decimal values must be integers'),
      )
      expect(() => normalizeBalance({ balance: 1n, decimal: 1 }, 1.5)).toThrow(
        new Error('Decimal values must be integers'),
      )
      expect(() => normalizeBalance({ balance: 1n, decimal: 1.5 }, 1.5)).toThrow(
        new Error('Decimal values must be integers'),
      )
    })

    it('should return the same value if current and target decimals are the same', () => {
      expect(normalizeBalance({ balance: 1234n, decimal: 6 }, 6)).toEqual({
        balance: 1234n,
        decimal: 6,
      })
    })

    it('should scale up', () => {
      expect(normalizeBalance({ balance: 10_000n, decimal: 4 }, 6)).toEqual({
        balance: 1_000_000n,
        decimal: 6,
      })
    })

    it('should scale down', () => {
      expect(normalizeBalance({ balance: 1_000_000n, decimal: 6 }, 4)).toEqual({
        balance: 10_000n,
        decimal: 4,
      })
    })

    it('should work with zero', () => {
      expect(normalizeBalance({ balance: 1n, decimal: 0 }, 3)).toEqual({
        balance: 1_000n,
        decimal: 3,
      })
      expect(normalizeBalance({ balance: 100n, decimal: 2 }, 0)).toEqual({
        balance: 1n,
        decimal: 0,
      })
    })
  })

  describe('compareNormalizedTotals', () => {
    it('should return true when both token and native values in first total are greater than second', () => {
      const a = { token: 1000n, native: 500n }
      const b = { token: 800n, native: 300n }
      expect(compareNormalizedTotals(a, b)).toBe(true)
    })

    it('should return true when both token and native values in first total are equal to second', () => {
      const a = { token: 1000n, native: 500n }
      const b = { token: 1000n, native: 500n }
      expect(compareNormalizedTotals(a, b)).toBe(true)
    })

    it('should return true when token is greater and native is equal', () => {
      const a = { token: 1000n, native: 500n }
      const b = { token: 800n, native: 500n }
      expect(compareNormalizedTotals(a, b)).toBe(true)
    })

    it('should return true when token is equal and native is greater', () => {
      const a = { token: 1000n, native: 500n }
      const b = { token: 1000n, native: 300n }
      expect(compareNormalizedTotals(a, b)).toBe(true)
    })

    it('should return false when token value in first total is less than second', () => {
      const a = { token: 800n, native: 500n }
      const b = { token: 1000n, native: 300n }
      expect(compareNormalizedTotals(a, b)).toBe(false)
    })

    it('should return false when native value in first total is less than second', () => {
      const a = { token: 1000n, native: 300n }
      const b = { token: 800n, native: 500n }
      expect(compareNormalizedTotals(a, b)).toBe(false)
    })

    it('should return false when both token and native values in first total are less than second', () => {
      const a = { token: 800n, native: 300n }
      const b = { token: 1000n, native: 500n }
      expect(compareNormalizedTotals(a, b)).toBe(false)
    })

    it('should handle zero values correctly', () => {
      const a = { token: 0n, native: 0n }
      const b = { token: 0n, native: 0n }
      expect(compareNormalizedTotals(a, b)).toBe(true)
    })

    it('should handle zero values when first is greater', () => {
      const a = { token: 100n, native: 50n }
      const b = { token: 0n, native: 0n }
      expect(compareNormalizedTotals(a, b)).toBe(true)
    })

    it('should handle zero values when second is greater', () => {
      const a = { token: 0n, native: 0n }
      const b = { token: 100n, native: 50n }
      expect(compareNormalizedTotals(a, b)).toBe(false)
    })

    it('should handle large bigint values', () => {
      const a = { token: BigInt('999999999999999999999'), native: BigInt('888888888888888888888') }
      const b = { token: BigInt('999999999999999999998'), native: BigInt('888888888888888888887') }
      expect(compareNormalizedTotals(a, b)).toBe(true)
    })

    it('should handle mixed zero and non-zero values', () => {
      const a = { token: 1000n, native: 0n }
      const b = { token: 500n, native: 100n }
      expect(compareNormalizedTotals(a, b)).toBe(false)
    })
  })
})
