import { multiplyByPercentage, DEFAULT_DECIMAL_PRECISION } from './math'
import { getRangeFromPercentage } from '@/liquidity-manager/utils/math'
import { TokenBalance } from '@/balance/types'

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
      expect(() => multiplyByPercentage(1000n, -0.1)).toThrow('Percentage must be non-negative')
    })

    it('should accept percentage greater than 1', () => {
      expect(() => multiplyByPercentage(1000n, 1.1)).not.toThrow()
    })

    it('should accept percentage equal to 1.1', () => {
      expect(() => multiplyByPercentage(1000n, 1.000001)).not.toThrow()
    })

    it('should accept percentage equal to 0', () => {
      expect(() => multiplyByPercentage(1000n, 0)).not.toThrow()
    })

    it('should accept percentage equal to 1', () => {
      expect(() => multiplyByPercentage(1000n, 1)).not.toThrow()
    })

    it('should throw error for decimal precision greater than 18', () => {
      expect(() => multiplyByPercentage(1000n, 0.5, 19)).toThrow(
        'Decimal precision cannot be greater than 18',
      )
    })

    it('should throw error for decimal precision equal to 19', () => {
      expect(() => multiplyByPercentage(1000n, 0.5, 19)).toThrow(
        'Decimal precision cannot be greater than 18',
      )
    })

    it('should accept decimal precision equal to 18', () => {
      expect(() => multiplyByPercentage(1000n, 0.5, 18)).not.toThrow()
    })

    it('should throw error for negative decimal precision', () => {
      expect(() => multiplyByPercentage(1000n, 0.5, -1)).toThrow(
        'Decimal precision cannot be greater than 18',
      )
    })

    it('should throw error for decimal precision of 0', () => {
      expect(() => multiplyByPercentage(1000n, 0.5, 0)).toThrow(
        'Decimal precision cannot be greater than 18',
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

describe('getRangeFromPercentage', () => {
  describe('basic functionality', () => {
    it('should calculate min and max range correctly with symmetric percentages', () => {
      const tokenBalance: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: 18, // Use 18 decimals (standard ERC20)
        balance: 1000000000000000000000n, // 1000 tokens with 18 decimals
      }
      const percentage = { up: 0.1, down: 0.1 }
      const result = getRangeFromPercentage(tokenBalance, percentage)

      expect(result.min).toBe(900000000000000000000n) // 900 tokens
      expect(result.max).toBe(1100000000000000128000n) // 1100 tokens (with precision rounding)
    })

    it('should calculate min and max range correctly with asymmetric percentages', () => {
      const tokenBalance: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: 18, // Use 18 decimals (standard ERC20)
        balance: 1000000000000000000000n, // 1000 tokens with 18 decimals
      }
      const percentage = { up: 0.2, down: 0.05 }
      const result = getRangeFromPercentage(tokenBalance, percentage)

      expect(result.min).toBe(950000000000000000000n) // 950 tokens
      expect(result.max).toBe(1200000000000000000000n) // 1200 tokens
    })

    it('should handle zero balance', () => {
      const tokenBalance: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: 18,
        balance: 0n,
      }
      const percentage = { up: 0.1, down: 0.1 }
      const result = getRangeFromPercentage(tokenBalance, percentage)

      expect(result.min).toBe(0n)
      expect(result.max).toBe(0n)
    })

    it('should handle zero percentages', () => {
      const tokenBalance: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: 18,
        balance: 1000000000000000000000n, // 1000 tokens with 18 decimals
      }
      const percentage = { up: 0, down: 0 }
      const result = getRangeFromPercentage(tokenBalance, percentage)

      expect(result.min).toBe(1000000000000000000000n)
      expect(result.max).toBe(1000000000000000000000n)
    })
  })

  describe('edge cases', () => {
    it('should handle 100% down percentage', () => {
      const tokenBalance: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: 18,
        balance: 1000000000000000000000n, // 1000 tokens with 18 decimals
      }
      const percentage = { up: 0.1, down: 1.0 }
      const result = getRangeFromPercentage(tokenBalance, percentage)

      expect(result.min).toBe(0n) // 1000 * (1 - 1.0)
      expect(result.max).toBe(1100000000000000128000n) // 1100 tokens (with precision rounding)
    })

    it('should handle large up percentage', () => {
      const tokenBalance: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: 18,
        balance: 1000000000000000000000n, // 1000 tokens with 18 decimals
      }
      const percentage = { up: 2.0, down: 0.1 }
      const result = getRangeFromPercentage(tokenBalance, percentage)

      expect(result.min).toBe(900000000000000000000n) // 900 tokens
      expect(result.max).toBe(3000000000000000000000n) // 3000 tokens
    })

    it('should handle very small percentages with high precision', () => {
      const tokenBalance: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: 18,
        balance: 1000000000000000000000n, // 1000 tokens with 18 decimals
      }
      const percentage = { up: 0.000001, down: 0.000001 }
      const result = getRangeFromPercentage(tokenBalance, percentage)

      expect(result.min).toBe(999999000000000000000n) // 999.999 tokens
      expect(result.max).toBe(1000000999999999872000n) // 1000.001 tokens (with precision rounding)
    })
  })

  describe('DeFi use cases', () => {
    it('should handle typical slippage calculations for 18-decimal tokens', () => {
      const tokenBalance: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: 18,
        balance: 1000000000000000000n, // 1 token with 18 decimals
      }
      const slippage = { up: 0.005, down: 0.005 } // 0.5% slippage
      const result = getRangeFromPercentage(tokenBalance, slippage)

      expect(result.min).toBe(995000000000000000n) // 0.995 tokens
      expect(result.max).toBe(1004999999999999872n) // 1.005 tokens (with precision rounding)
    })

    it('should handle price impact calculations', () => {
      const tokenBalance: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: 18,
        balance: 10000000000000000000n, // 10 tokens with 18 decimals
      }
      const priceImpact = { up: 0.02, down: 0.015 } // 2% up, 1.5% down
      const result = getRangeFromPercentage(tokenBalance, priceImpact)

      expect(result.min).toBe(9850000000000000000n) // 9.85 tokens
      expect(result.max).toBe(10200000000000000000n) // 10.2 tokens
    })

    it('should handle basis points calculations', () => {
      const tokenBalance: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: 6, // USDC-like token with 6 decimals
        balance: 1000000n, // 1 USDC with 6 decimals
      }
      const basisPoints = { up: 0.01, down: 0.01 } // 100 basis points each (1%)
      const result = getRangeFromPercentage(tokenBalance, basisPoints)

      expect(result.min).toBe(990000n) // 0.99 USDC
      expect(result.max).toBe(1010000n) // 1.01 USDC
    })
  })

  describe('precision handling', () => {
    it('should maintain precision for small amounts with large percentages', () => {
      const tokenBalance: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: 18,
        balance: 1n, // 1 wei (smallest unit)
      }
      const percentage = { up: 0.5, down: 0.5 }
      const result = getRangeFromPercentage(tokenBalance, percentage)

      expect(result.min).toBe(0n) // 1 * (1 - 0.5) = 0.5, rounds down to 0
      expect(result.max).toBe(1n) // 1 * (1 + 0.5) = 1.5, rounds down to 1
    })

    it('should handle large amounts with small percentages using token decimals', () => {
      const tokenBalance: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: 18,
        balance: 999999999999999999999n, // 999.999999999999999999 tokens
      }
      const percentage = { up: 0.000001, down: 0.000001 }
      const result = getRangeFromPercentage(tokenBalance, percentage)

      expect(result.min).toBe(999998999999999999999n) // 999.998999999999999999 tokens
      expect(result.max).toBe(1000000999999999871998n) // 1000.001 tokens (with precision rounding)
    })

    it('should handle different token decimals correctly', () => {
      const usdcBalance: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: 6, // USDC has 6 decimals
        balance: 1000000n, // 1 USDC
      }
      const percentage = { up: 0.1, down: 0.1 } // 10% up/down
      const result = getRangeFromPercentage(usdcBalance, percentage)

      expect(result.min).toBe(900000n) // 0.9 USDC
      expect(result.max).toBe(1100000n) // 1.1 USDC
    })
  })
})
