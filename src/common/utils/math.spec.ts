import { multiplyByPercentage, DEFAULT_DECIMAL_PRECISION } from './math'

describe('multiplyByPercentage', () => {
  describe('basic functionality', () => {
    it('should multiply a value by a percentage with default precision', () => {
      const result = multiplyByPercentage(1000000n, 0.5)
      expect(result).toBe(500000n)
    })

    it('should handle zero percentage', () => {
      const result = multiplyByPercentage(1000000n, 0)
      expect(result).toBe(0n)
    })

    it('should handle 100% percentage', () => {
      const result = multiplyByPercentage(1000000n, 1)
      expect(result).toBe(1000000n)
    })

    it('should handle zero value', () => {
      const result = multiplyByPercentage(0n, 0.5)
      expect(result).toBe(0n)
    })
  })

  describe('decimal precision', () => {
    it('should use default decimal precision when not specified', () => {
      const result = multiplyByPercentage(1000000n, 0.123456)
      const expected = (1000000n * 123456n) / 10n ** BigInt(DEFAULT_DECIMAL_PRECISION)
      expect(result).toBe(expected)
    })

    it('should handle custom decimal precision', () => {
      const result = multiplyByPercentage(1000000n, 0.12, 2)
      expect(result).toBe(120000n)
    })

    it('should handle high precision calculations', () => {
      const result = multiplyByPercentage(1000000000000n, 0.123456789, 9)
      const expected = (1000000000000n * 123456789n) / 10n ** 9n
      expect(result).toBe(expected)
    })

    it('should handle precision of 1', () => {
      const result = multiplyByPercentage(1000000n, 0.1, 1)
      expect(result).toBe(100000n)
    })

    it('should handle precision of 12', () => {
      const result = multiplyByPercentage(1000000000000n, 0.000000000001, 12)
      expect(result).toBe(1n)
    })
  })

  describe('edge cases', () => {
    it('should handle very small percentages', () => {
      const result = multiplyByPercentage(1000000n, 0.000001)
      expect(result).toBe(1n)
    })

    it('should handle large values with small percentages', () => {
      const result = multiplyByPercentage(999999999999n, 0.000001)
      expect(result).toBe(999999n)
    })

    it('should round down fractional results', () => {
      const result = multiplyByPercentage(3n, 0.333333, 6)
      expect(result).toBe(0n) // 3 * 333333 / 1000000 = 0.999999, rounds down to 0
    })
  })

  describe('input validation', () => {
    it('should throw error for negative percentage', () => {
      expect(() => multiplyByPercentage(1000n, -0.1)).toThrow('Percentage must be between 0 and 1')
    })

    it('should throw error for percentage greater than 1', () => {
      expect(() => multiplyByPercentage(1000n, 1.1)).toThrow('Percentage must be between 0 and 1')
    })

    it('should throw error for percentage equal to 1.1', () => {
      expect(() => multiplyByPercentage(1000n, 1.000001)).toThrow(
        'Percentage must be between 0 and 1',
      )
    })

    it('should accept percentage equal to 0', () => {
      expect(() => multiplyByPercentage(1000n, 0)).not.toThrow()
    })

    it('should accept percentage equal to 1', () => {
      expect(() => multiplyByPercentage(1000n, 1)).not.toThrow()
    })

    it('should throw error for decimal precision greater than 12', () => {
      expect(() => multiplyByPercentage(1000n, 0.5, 13)).toThrow(
        'Decimal precision cannot be greater than 12',
      )
    })

    it('should throw error for decimal precision equal to 13', () => {
      expect(() => multiplyByPercentage(1000n, 0.5, 13)).toThrow(
        'Decimal precision cannot be greater than 12',
      )
    })

    it('should accept decimal precision equal to 12', () => {
      expect(() => multiplyByPercentage(1000n, 0.5, 12)).not.toThrow()
    })

    it('should throw error for negative decimal precision', () => {
      expect(() => multiplyByPercentage(1000n, 0.5, -1)).toThrow(
        'Decimal precision cannot be greater than 12',
      )
    })

    it('should throw error for decimal precision of 0', () => {
      expect(() => multiplyByPercentage(1000n, 0.5, 0)).toThrow(
        'Decimal precision cannot be greater than 12',
      )
    })
  })

  describe('overflow protection', () => {
    it('should throw error for value too large', () => {
      const largeValue = 2n ** 201n
      expect(() => multiplyByPercentage(largeValue, 0.5)).toThrow(
        'Value too large for safe multiplication',
      )
    })

    it('should handle maximum safe value', () => {
      const maxSafeValue = 2n ** 200n / 10000n - 1n
      expect(() => multiplyByPercentage(maxSafeValue, 0.5)).not.toThrow()
    })
  })

  describe('mathematical accuracy', () => {
    it('should maintain precision for typical DeFi calculations', () => {
      // Simulating 18-decimal token with 0.3% fee
      const tokenAmount = 1000000000000000000n // 1 token with 18 decimals
      const feePercentage = 0.003 // 0.3%
      const result = multiplyByPercentage(tokenAmount, feePercentage)
      expect(result).toBe(3000000000000000n) // 0.003 tokens
    })

    it('should handle basis points correctly', () => {
      const value = 10000000000n
      const basisPoints = 0.0001 // 1 basis point = 0.01%
      const result = multiplyByPercentage(value, basisPoints)
      expect(result).toBe(1000000n)
    })
  })
})
