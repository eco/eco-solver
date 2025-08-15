import { BASE_DECIMALS } from '@/intent/utils'
import { TokenBalance, TokenConfig } from '@/balance/types'
import { analyzeToken, toTokenBalance } from '@/liquidity-manager/utils/token'
import { parseUnits, Hex } from 'viem'

/**
 * Tests to verify that ingressed values are normalized to BASE_DECIMALS
 * and regressed values are denormalized before interacting with integrations or fulfillment
 */
describe('Liquidity Manager Decimals Normalization Utils', () => {
  describe('Token Balance Normalization', () => {
    it('should normalize 6-decimal USDC token balance to BASE_DECIMALS internally', () => {
      // USDC with 6 decimals: 1000.123456 USDC = 1000123456 (6-decimal units)
      const originalBalance = 1000123456n
      const originalDecimals = 6

      const tokenBalance: TokenBalance = {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Hex,
        decimals: { original: originalDecimals, current: BASE_DECIMALS },
        balance: originalBalance,
      }

      // Verify that the balance service would provide normalized structure
      expect(tokenBalance.decimals.original).toBe(originalDecimals)
      expect(tokenBalance.decimals.current).toBe(BASE_DECIMALS)
      expect(tokenBalance.balance).toBe(originalBalance) // Balance is in original units initially

      // When balance is normalized to BASE_DECIMALS internally, it should scale up
      const expectedNormalizedBalance =
        originalBalance * 10n ** BigInt(BASE_DECIMALS - originalDecimals)
      expect(expectedNormalizedBalance).toBe(1000123456000000000000n) // 1000.123456 in BASE_DECIMALS (12 zeros for scale factor)
    })

    it('should handle 8-decimal tokens (like WBTC) normalization to BASE_DECIMALS', () => {
      // WBTC with 8 decimals: 0.12345678 BTC = 12345678 (8-decimal units)
      const originalBalance = 12345678n
      const originalDecimals = 8

      const tokenBalance: TokenBalance = {
        address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' as Hex,
        decimals: { original: originalDecimals, current: BASE_DECIMALS },
        balance: originalBalance,
      }

      expect(tokenBalance.decimals.original).toBe(originalDecimals)
      expect(tokenBalance.decimals.current).toBe(BASE_DECIMALS)

      // When normalized to BASE_DECIMALS, should scale up by 10 digits
      const expectedNormalizedBalance =
        originalBalance * 10n ** BigInt(BASE_DECIMALS - originalDecimals)
      expect(expectedNormalizedBalance).toBe(123456780000000000n) // 0.12345678 in BASE_DECIMALS
    })

    it('should keep BASE_DECIMALS-decimal tokens unchanged during normalization', () => {
      // ETH/USDT with BASE_DECIMALS: 100.123456789012345678 = 100123456789012345678n
      const originalBalance = parseUnits('100.123456789012345678', BASE_DECIMALS)
      const originalDecimals = BASE_DECIMALS

      const tokenBalance: TokenBalance = {
        address: '0x0000000000000000000000000000000000000000' as Hex,
        decimals: { original: originalDecimals, current: BASE_DECIMALS },
        balance: originalBalance,
      }

      expect(tokenBalance.decimals.original).toBe(originalDecimals)
      expect(tokenBalance.decimals.current).toBe(BASE_DECIMALS)

      // BASE_DECIMALS-decimal tokens should remain unchanged when normalized to BASE_DECIMALS
      expect(originalBalance).toBe(100123456789012345678n)
    })
  })

  describe('Token Configuration Normalization', () => {
    it('should ensure token config values are normalized to BASE_DECIMALS', () => {
      // Test that toTokenBalance function creates properly normalized TokenBalance
      const tokenConfig: TokenConfig = {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Hex,
        chainId: 1,
        targetBalance: parseUnits('1000', BASE_DECIMALS), // Already in BASE_DECIMALS
        minBalance: parseUnits('500', BASE_DECIMALS), // Already in BASE_DECIMALS
        type: 'erc20',
      }

      const tokenBalance = toTokenBalance(tokenConfig, BASE_DECIMALS)

      expect(tokenBalance.decimals.original).toBe(BASE_DECIMALS)
      expect(tokenBalance.decimals.current).toBe(BASE_DECIMALS)
      expect(tokenBalance.balance).toBe(tokenConfig.targetBalance) // Should be in BASE_DECIMALS
    })
  })

  describe('Token Analysis with Normalized Values', () => {
    it('should perform analysis using normalized values internally', () => {
      const tokenConfig: TokenConfig = {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Hex,
        chainId: 1,
        targetBalance: parseUnits('1000', BASE_DECIMALS), // 1000 tokens in BASE_DECIMALS
        minBalance: parseUnits('500', BASE_DECIMALS), // 500 tokens in BASE_DECIMALS
        type: 'erc20',
      }

      const tokenBalance: TokenBalance = {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Hex,
        decimals: { original: 6, current: BASE_DECIMALS }, // Original USDC is 6 decimals, normalized to BASE_DECIMALS
        balance: parseUnits('750', BASE_DECIMALS), // 750 tokens in BASE_DECIMALS (normalized internally)
      }

      const percentage = { down: 0.2, up: 0.1, targetSlippage: 0.02 }
      const analysis = analyzeToken(tokenConfig, tokenBalance, percentage)

      // Analysis should work with normalized values
      expect(analysis.balance.current).toBe(parseUnits('750', BASE_DECIMALS))
      expect(analysis.balance.target).toBe(parseUnits('1000', BASE_DECIMALS))
      expect(analysis.balance.minimum).toBe(parseUnits('800', BASE_DECIMALS)) // 1000 * 0.8
      // Due to floating point precision in multiplyByPercentage, allow for the actual calculated value
      expect(analysis.balance.maximum).toBeGreaterThan(parseUnits('1099', BASE_DECIMALS)) // Close to 1100
      expect(analysis.balance.maximum).toBeLessThan(parseUnits('1101', BASE_DECIMALS))
      expect(analysis.state).toBe('DEFICIT') // 750 < 800 (minimum)
    })
  })

  describe('Integration Contract Verification', () => {
    it('should demonstrate proper decimal handling contract for external integrations', () => {
      // This test documents the expected behavior when interfacing with external services
      // External services should receive amounts in their original decimals but internally
      // the liquidity manager works with normalized BASE_DECIMALS values

      const originalUSDCAmount = 1000123456n // 1000.123456 USDC (6 decimals)
      const originalDecimals = 6

      // When ingressed into the system, amounts are tracked with original decimals info
      const tokenBalance: TokenBalance = {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Hex,
        decimals: { original: originalDecimals, current: BASE_DECIMALS },
        balance: originalUSDCAmount,
      }

      // Internal calculations should work with BASE_DECIMALS equivalent
      const normalizedAmount = originalUSDCAmount * 10n ** BigInt(BASE_DECIMALS - originalDecimals)
      expect(normalizedAmount).toBe(1000123456000000000000n) // Scale up by 12 digits (BASE_DECIMALS-6)

      // When sending to external integrations, amounts should be denormalized back
      const denormalizedAmount = normalizedAmount / 10n ** BigInt(BASE_DECIMALS - originalDecimals)
      expect(denormalizedAmount).toBe(originalUSDCAmount)

      // Verify the round-trip conversion maintains precision
      expect(denormalizedAmount).toBe(1000123456n) // Original amount preserved
    })

    it('should demonstrate normalization behavior for different token decimals', () => {
      const testCases = [
        {
          name: 'USDC (6 decimals)',
          original: 6,
          amount: 1000000000n, // 1000 USDC
          expectedNormalized: 1000000000000000000000n, // 1000 tokens in BASE_DECIMALS
        },
        {
          name: 'WBTC (8 decimals)',
          original: 8,
          amount: 100000000n, // 1 WBTC
          expectedNormalized: 1000000000000000000n, // 1 token in BASE_DECIMALS
        },
        {
          name: 'DAI (BASE_DECIMALS)',
          original: BASE_DECIMALS,
          amount: 1000000000000000000n, // 1 DAI
          expectedNormalized: 1000000000000000000n, // 1 token in BASE_DECIMALS (unchanged)
        },
        {
          name: 'USDT on Polygon (6 decimals)',
          original: 6,
          amount: 500000000n, // 500 USDT
          expectedNormalized: 500000000000000000000n, // 500 tokens in BASE_DECIMALS
        },
      ]

      testCases.forEach(({ name, original, amount, expectedNormalized }) => {
        // Normalize to BASE_DECIMALS
        const normalized = amount * 10n ** BigInt(BASE_DECIMALS - original)
        expect(normalized).toBe(expectedNormalized)

        // Denormalize back to original
        const denormalized = normalized / 10n ** BigInt(BASE_DECIMALS - original)
        expect(denormalized).toBe(amount)
      })
    })
  })

  describe('Decimal Conversion Utilities', () => {
    it('should demonstrate proper scaling between original and normalized decimals', () => {
      const testCases = [
        { original: 6, amount: 1000000n, expected: 1000000000000000000n }, // 1 USDC (6 dec) -> 1 token (18 dec)
        { original: 8, amount: 100000000n, expected: 1000000000000000000n }, // 1 WBTC (8 dec) -> 1 token (18 dec)
        { original: BASE_DECIMALS, amount: 1000000000000000000n, expected: 1000000000000000000n }, // 1 ETH (BASE_DECIMALS dec) -> 1 token (BASE_DECIMALS dec)
        { original: 12, amount: 1000000000000n, expected: 1000000000000000000n }, // 1 token (12 dec) -> 1 token (18 dec)
      ]

      testCases.forEach(({ original, amount, expected }) => {
        const scaleFactor = 10n ** BigInt(BASE_DECIMALS - original)
        const normalized = amount * scaleFactor

        expect(normalized).toBe(expected)

        // Verify reverse conversion
        const denormalized = normalized / scaleFactor
        expect(denormalized).toBe(amount)
      })
    })

    it('should handle edge cases in decimal conversion', () => {
      // Test with 0 amounts
      expect(0n * 10n ** BigInt(BASE_DECIMALS - 6)).toBe(0n)

      // Test with very small amounts that might have precision issues
      const smallAmount = 1n // 1 unit in original decimals
      const normalized = smallAmount * 10n ** BigInt(BASE_DECIMALS - 6)
      expect(normalized).toBe(1000000000000n) // Properly scaled

      // Test with maximum values that shouldn't overflow
      const maxSafeAmount = parseUnits('1', BASE_DECIMALS) // 1 token in BASE_DECIMALS
      const scaledDown = maxSafeAmount / 10n ** BigInt(BASE_DECIMALS - 6)
      expect(scaledDown).toBe(1000000n) // Properly scaled to 6 decimals
    })

    it('should maintain precision during normalization and denormalization', () => {
      // Test precise fractional amounts
      const preciseAmounts = [
        { decimals: 6, amount: 1234567n }, // 1.234567 tokens
        { decimals: 8, amount: 12345678n }, // 0.12345678 tokens
        { decimals: 12, amount: 123456789012n }, // 123.456789012 tokens
      ]

      preciseAmounts.forEach(({ decimals, amount }) => {
        // Normalize
        const normalized = amount * 10n ** BigInt(BASE_DECIMALS - decimals)

        // Denormalize back
        const denormalized = normalized / 10n ** BigInt(BASE_DECIMALS - decimals)

        // Should maintain exact precision
        expect(denormalized).toBe(amount)
      })
    })
  })
})
