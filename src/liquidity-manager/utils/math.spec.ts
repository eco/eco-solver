import { getTotalSlippage, getSlippagePercent } from './math'
import { TokenBalance } from '@/balance/types'
import { BASE_DECIMALS } from '@/intent/utils'

describe('math utils', () => {
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
      expect(result).toBe(0.0444)
    })

    it('should handle the example from the comment', () => {
      // Example from the function comment
      const result = getTotalSlippage([0.01, 0.02, 0.015])
      expect(result).toBe(0.0444)
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
      expect(result).toBe(0.005)
    })

    it('should handle case that slightly exceeds typical limit', () => {
      // Two 0.3% slippages
      const result = getTotalSlippage([0.003, 0.003])
      // 1 - (0.997 * 0.997) = 0.005991
      expect(result).toBe(0.006)
    })
  })

  describe('getSlippagePercent', () => {
    it('should return 0 when fromAmount is 0', () => {
      const dstTokenMin: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: { original: BASE_DECIMALS, current: BASE_DECIMALS },
        balance: 100n,
      }
      const srcToken: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: { original: BASE_DECIMALS, current: BASE_DECIMALS },
        balance: 0n,
      }
      const slippage = getSlippagePercent(dstTokenMin, srcToken)
      expect(slippage).toBe(0)
    })

    it('should calculate slippage correctly for standard numbers', () => {
      // (1000 - 995) / 1000 = 0.005
      const dstTokenMin: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: { original: BASE_DECIMALS, current: BASE_DECIMALS },
        balance: 995n,
      }
      const srcToken: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: { original: BASE_DECIMALS, current: BASE_DECIMALS },
        balance: 1000n,
      }
      const slippage = getSlippagePercent(dstTokenMin, srcToken)
      expect(slippage).toBe(0.005)
    })

    it('should return 0 when toAmountMin equals fromAmount', () => {
      const dstTokenMin: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: { original: BASE_DECIMALS, current: BASE_DECIMALS },
        balance: 1000n,
      }
      const srcToken: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: { original: BASE_DECIMALS, current: BASE_DECIMALS },
        balance: 1000n,
      }
      const slippage = getSlippagePercent(dstTokenMin, srcToken)
      expect(slippage).toBe(0)
    })

    it('should handle large numbers without loss of precision', () => {
      const fromAmount = 100000000000000000000n // 100 ETH in wei
      const toAmountMin = 99500000000000000000n // 99.5 ETH in wei
      const dstTokenMin: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: { original: BASE_DECIMALS, current: BASE_DECIMALS },
        balance: toAmountMin,
      }
      const srcToken: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: { original: BASE_DECIMALS, current: BASE_DECIMALS },
        balance: fromAmount,
      }
      const slippage = getSlippagePercent(dstTokenMin, srcToken)
      expect(slippage).toBe(0.005)
    })

    it('should handle very large numbers that would overflow standard Number', () => {
      const fromAmount = 90071992547409930000n // Larger than MAX_SAFE_INTEGER
      const toAmountMin = 90062985348155189007n // Represents a 0.01% slippage
      const dstTokenMin: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: { original: BASE_DECIMALS, current: BASE_DECIMALS },
        balance: toAmountMin,
      }
      const srcToken: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: { original: BASE_DECIMALS, current: BASE_DECIMALS },
        balance: fromAmount,
      }
      const slippage = getSlippagePercent(dstTokenMin, srcToken)
      // Using toBeCloseTo for floating point comparison
      expect(slippage).toBeCloseTo(0.0001)
    })

    it('should calculate slippage with several decimal places correctly', () => {
      // (100000 - 99370) / 100000 = 0.0063
      const fromAmount = 100000n
      const toAmountMin = 99370n
      const dstTokenMin: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: { original: BASE_DECIMALS, current: BASE_DECIMALS },
        balance: toAmountMin,
      }
      const srcToken: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: { original: BASE_DECIMALS, current: BASE_DECIMALS },
        balance: fromAmount,
      }
      const slippage = getSlippagePercent(dstTokenMin, srcToken)
      expect(slippage).toBe(0.0063)
    })

    it('should return 1 for 100% slippage if toAmountMin is 0', () => {
      const dstTokenMin: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: { original: BASE_DECIMALS, current: BASE_DECIMALS },
        balance: 0n,
      }
      const srcToken: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: { original: BASE_DECIMALS, current: BASE_DECIMALS },
        balance: 1000n,
      }
      const slippage = getSlippagePercent(dstTokenMin, srcToken)
      expect(slippage).toBe(1)
    })

    it('should handle different token decimals correctly', () => {
      // Test with different decimals for src and dst tokens
      // Simulate: started with 1000 USDC (6 decimals), ended with 995 USDC (6 decimals)
      // This should be 0.5% slippage: (1000-995)/1000 = 0.005
      const dstTokenMin: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: { original: 6, current: BASE_DECIMALS }, // USDC-like (6 decimals)
        balance: 995000000000000000000n, // 995 USDC normalized to 18 decimals
      }
      const srcToken: TokenBalance = {
        address: '0x1234567890123456789012345678901234567890',
        decimals: { original: 6, current: BASE_DECIMALS }, // USDC-like (6 decimals)
        balance: 1000000000000000000000n, // 1000 USDC normalized to 18 decimals
      }
      const slippage = getSlippagePercent(dstTokenMin, srcToken)
      expect(slippage).toBe(0.005) // Still 0.5% slippage after normalization
    })
  })
})
