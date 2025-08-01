import { mul } from '../bigint'

describe('bigint utils', () => {
  describe('mul', () => {
    it('should multiply bigint by percentage correctly', () => {
      expect(mul(100n, 0.05)).toBe(5n)
      expect(mul(1000n, 0.1)).toBe(100n)
      expect(mul(1000n, 0.25)).toBe(250n)
      expect(mul(1000n, 0.5)).toBe(500n)
      expect(mul(1000n, 1)).toBe(1000n)
    })

    it('should handle zero values', () => {
      expect(mul(0n, 0.5)).toBe(0n)
      expect(mul(1000n, 0)).toBe(0n)
    })

    it('should handle small percentages', () => {
      expect(mul(1000000n, 0.001)).toBe(1000n)
      expect(mul(1000000n, 0.0001)).toBe(100n)
    })

    it('should handle large numbers', () => {
      const largeNumber = 1000000000000000000n
      expect(mul(largeNumber, 0.1)).toBe(100000000000000000n)
      expect(mul(largeNumber, 0.01)).toBe(10000000000000000n)
    })

    it('should handle negative bigints', () => {
      expect(mul(-100n, 0.05)).toBe(-5n)
      expect(mul(-1000n, 0.1)).toBe(-100n)
    })

    it('should handle percentages greater than 1', () => {
      expect(mul(100n, 1.5)).toBe(150n)
      expect(mul(100n, 2)).toBe(200n)
      expect(mul(100n, 2.5)).toBe(250n)
    })

    it('should handle precision correctly', () => {
      expect(mul(333n, 0.333333)).toBe(110n)
      expect(mul(1000n, 0.123456)).toBe(123n)
    })
  })
})
