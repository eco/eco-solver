import { normalizeBalance, isInsufficient } from '@/fee/utils'

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

  describe('isInsufficient', () => {
    it('should return true when reward is insufficient (less than ask)', () => {
      const ask = { token: 1000n, native: 500n }
      const reward = { token: 800n, native: 300n }
      expect(isInsufficient(ask, reward)).toBe(true)
    })

    it('should return false when reward equals ask (sufficient)', () => {
      const ask = { token: 1000n, native: 500n }
      const reward = { token: 1000n, native: 500n }
      expect(isInsufficient(ask, reward)).toBe(false)
    })

    it('should return true when reward token is insufficient but native is sufficient', () => {
      const ask = { token: 1000n, native: 500n }
      const reward = { token: 800n, native: 500n }
      expect(isInsufficient(ask, reward)).toBe(true)
    })

    it('should return true when reward native is insufficient but token is sufficient', () => {
      const ask = { token: 1000n, native: 500n }
      const reward = { token: 1000n, native: 300n }
      expect(isInsufficient(ask, reward)).toBe(true)
    })

    it('should return false when reward token exceeds ask (sufficient)', () => {
      const ask = { token: 800n, native: 500n }
      const reward = { token: 1000n, native: 600n }
      expect(isInsufficient(ask, reward)).toBe(false)
    })

    it('should return true when reward token is insufficient even if native exceeds ask', () => {
      const ask = { token: 1000n, native: 300n }
      const reward = { token: 800n, native: 500n }
      expect(isInsufficient(ask, reward)).toBe(true)
    })

    it('should return false when reward exceeds ask for both token and native', () => {
      const ask = { token: 800n, native: 300n }
      const reward = { token: 1000n, native: 500n }
      expect(isInsufficient(ask, reward)).toBe(false)
    })

    it('should handle zero values correctly (sufficient)', () => {
      const ask = { token: 0n, native: 0n }
      const reward = { token: 0n, native: 0n }
      expect(isInsufficient(ask, reward)).toBe(false)
    })

    it('should handle zero reward when ask is positive (insufficient)', () => {
      const ask = { token: 100n, native: 50n }
      const reward = { token: 0n, native: 0n }
      expect(isInsufficient(ask, reward)).toBe(true)
    })

    it('should handle zero ask when reward is positive (sufficient)', () => {
      const ask = { token: 0n, native: 0n }
      const reward = { token: 100n, native: 50n }
      expect(isInsufficient(ask, reward)).toBe(false)
    })

    it('should handle large bigint values (insufficient)', () => {
      const ask = {
        token: BigInt('999999999999999999999'),
        native: BigInt('888888888888888888888'),
      }
      const reward = {
        token: BigInt('999999999999999999998'),
        native: BigInt('888888888888888888887'),
      }
      expect(isInsufficient(ask, reward)).toBe(true)
    })

    it('should handle mixed zero and non-zero values (insufficient)', () => {
      const ask = { token: 1000n, native: 0n }
      const reward = { token: 500n, native: 100n }
      expect(isInsufficient(ask, reward)).toBe(true)
    })
  })
})
