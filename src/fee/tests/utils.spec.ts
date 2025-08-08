import {
  normalizeBalance,
  isInsufficient,
  convertNormalize,
  convertNormScalar,
  convertNormScalarBase6,
  deconvertNormalize,
  calculateDelta,
} from '@/fee/utils'
import { TokenFetchAnalysis } from '@/balance/balance.service'
import { Hex } from 'viem'
import { BASE_DECIMALS } from '@/intent/utils'

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

  describe('convertNormalize', () => {
    it('should convert and normalize token to standard reserve value', () => {
      const value = 100n
      const token = { chainID: 1n, address: '0x123' as Hex, decimals: 6 }
      const result = convertNormalize(value, token)

      expect(result).toEqual({
        chainID: 1n,
        address: '0x123',
        decimals: {
          original: 6,
          current: BASE_DECIMALS,
        },
        balance: 100_000_000_000_000n, // 100 * 10^(18-6) = 100 * 10^12
      })
    })

    it('should handle different decimal conversions', () => {
      const value = 1000n
      const token = { chainID: 10n, address: '0xabc' as Hex, decimals: 8 }
      const result = convertNormalize(value, token)

      expect(result).toEqual({
        chainID: 10n,
        address: '0xabc',
        decimals: {
          original: 8,
          current: BASE_DECIMALS,
        },
        balance: 10_000_000_000_000n, // 1000 * 10^(18-8) = 1000 * 10^10
      })
    })
  })

  describe('convertNormScalar', () => {
    it('should convert value from one decimal representation to BASE_DECIMALS (18)', () => {
      const value = 100n
      const fromDecimals = 6
      const result = convertNormScalar(value, fromDecimals)

      expect(result).toEqual(100_000_000_000_000n) // 100 * 10^(18-6)
    })

    it('should handle base 8 to base 18 conversion', () => {
      const value = 1000n
      const fromDecimals = 8
      const result = convertNormScalar(value, fromDecimals)

      expect(result).toEqual(10_000_000_000_000n) // 1000 * 10^(18-8)
    })
  })

  describe('convertNormScalarBase6', () => {
    it('should convert value from base 6 to base 18', () => {
      const value = 100n
      const result = convertNormScalarBase6(value)

      expect(result).toEqual(100_000_000_000_000n) // 100 * 10^(18-6)
    })

    it('should handle large values', () => {
      const value = 1_000_000n
      const result = convertNormScalarBase6(value)

      expect(result).toEqual(1_000_000_000_000_000_000n) // 1_000_000 * 10^12
    })
  })

  describe('deconvertNormalize', () => {
    it('should deconvert and denormalize from BASE_DECIMALS to token decimals', () => {
      const value = 100_000_000_000_000n // 100 in base 18
      const token = { chainID: 1n, address: '0x123' as Hex, decimals: 6 }
      const result = deconvertNormalize(value, token)

      expect(result).toEqual({
        chainID: 1n,
        address: '0x123',
        decimals: 6,
        balance: 100n, // 100_000_000_000_000n / 10^(18-6)
      })
    })

    it('should handle different decimal conversions', () => {
      const value = 10_000_000_000_000n // 1000 in base 18
      const token = { chainID: 10n, address: '0xabc' as Hex, decimals: 8 }
      const result = deconvertNormalize(value, token)

      expect(result).toEqual({
        chainID: 10n,
        address: '0xabc',
        decimals: 8,
        balance: 1000n, // 10_000_000_000_000n / 10^(18-8)
      })
    })
  })

  describe('calculateDelta', () => {
    it('should calculate delta as balance - minBalance', () => {
      const tokenAnalysis: TokenFetchAnalysis = {
        config: {
          address: '0x123' as Hex,
          chainId: 10,
          minBalance: 200_000_000_000_000_000_000n, // 200 normalized to 18 decimals
          targetBalance: 500_000_000_000_000_000_000n, // 500 normalized to 18 decimals
          type: 'erc20',
        },
        token: {
          address: '0x123' as Hex,
          decimals: {
            original: 6,
            current: BASE_DECIMALS,
          },
          balance: 300_000_000_000_000_000_000n, // 300 normalized to 18 decimals
        },
        chainId: 10,
      }

      const result = calculateDelta(tokenAnalysis)

      // delta = 300_000_000_000_000_000_000n - 200_000_000_000_000_000_000n = 100_000_000_000_000_000_000n
      expect(result).toEqual({
        chainID: 10n,
        address: '0x123',
        decimals: {
          original: 6,
          current: BASE_DECIMALS,
        },
        balance: 100_000_000_000_000_000_000n,
      })
    })

    it('should handle deficit (negative delta)', () => {
      const tokenAnalysis: TokenFetchAnalysis = {
        config: {
          address: '0xabc' as Hex,
          chainId: 1,
          minBalance: 300_000_000_000_000_000_000n, // 300 normalized to 18 decimals
          targetBalance: 500_000_000_000_000_000_000n, // 500 normalized to 18 decimals
          type: 'erc20',
        },
        token: {
          address: '0xabc' as Hex,
          decimals: {
            original: 6,
            current: BASE_DECIMALS,
          },
          balance: 200_000_000_000_000_000_000n, // 200 normalized to 18 decimals
        },
        chainId: 1,
      }

      const result = calculateDelta(tokenAnalysis)

      // delta = 200_000_000_000_000_000_000n - 300_000_000_000_000_000_000n = -100_000_000_000_000_000_000n
      expect(result).toEqual({
        chainID: 1n,
        address: '0xabc',
        decimals: {
          original: 6,
          current: BASE_DECIMALS,
        },
        balance: -100_000_000_000_000_000_000n,
      })
    })
  })
})
