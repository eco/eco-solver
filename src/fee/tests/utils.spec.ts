import { normalizeBalance } from '@/fee/utils'

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
})
