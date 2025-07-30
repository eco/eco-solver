import { CCTPLiFiRoutePlanner } from './route-planner'
import { TokenData } from '@/liquidity-manager/types/types'
import { parseUnits, Hex } from 'viem'

describe('CCTPLiFiRoutePlanner', () => {
  const createTokenData = (chainId: number, address: string): TokenData => ({
    chainId,
    config: {
      address: address as Hex,
      chainId,
      minBalance: 0n,
      targetBalance: 0n,
      type: 'erc20',
    },
    balance: {
      address: address as Hex,
      decimals: 6,
      balance: parseUnits('1000', 6),
    },
  })

  afterEach(() => {
    // Reset to defaults after each test
    CCTPLiFiRoutePlanner.resetToDefaults()
  })

  describe('Default behavior', () => {
    it('should work with default USDC addresses without initialization', () => {
      const usdcEthereum = createTokenData(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
      const usdcOptimism = createTokenData(10, '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85')

      expect(CCTPLiFiRoutePlanner.isUSDC(usdcEthereum)).toBe(true)
      expect(CCTPLiFiRoutePlanner.isUSDC(usdcOptimism)).toBe(true)
      expect(CCTPLiFiRoutePlanner.validateCCTPSupport(1, 10)).toBe(true)
    })

    it('should plan routes using default addresses', () => {
      const tokenIn = createTokenData(1, '0xdAC17F958D2ee523a2206206994597C13D831ec7') // USDT
      const tokenOut = createTokenData(10, '0x4200000000000000000000000000000000000042') // OP

      const steps = CCTPLiFiRoutePlanner.planRoute(tokenIn, tokenOut)
      expect(steps).toHaveLength(3)
      expect(steps[0].type).toBe('sourceSwap')
      expect(steps[1].type).toBe('cctpBridge')
      expect(steps[2].type).toBe('destinationSwap')
    })

    it('should get USDC address for supported chains', () => {
      expect(CCTPLiFiRoutePlanner.getUSDCAddress(1)).toBe(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      )
      expect(CCTPLiFiRoutePlanner.getUSDCAddress(10)).toBe(
        '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      )
      expect(CCTPLiFiRoutePlanner.getUSDCAddress(137)).toBe(
        '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      )
    })
  })

  describe('Configuration updates', () => {
    it('should allow updating USDC addresses', () => {
      const customAddresses = {
        1: '0x1234567890123456789012345678901234567890' as Hex,
        10: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Hex,
      }

      CCTPLiFiRoutePlanner.updateUSDCAddresses(customAddresses)

      expect(CCTPLiFiRoutePlanner.getUSDCAddress(1)).toBe(
        '0x1234567890123456789012345678901234567890',
      )
      expect(CCTPLiFiRoutePlanner.getUSDCAddress(10)).toBe(
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      )
    })

    it('should use updated addresses for USDC detection', () => {
      const customAddresses = {
        1: '0x1234567890123456789012345678901234567890' as Hex,
      }

      CCTPLiFiRoutePlanner.updateUSDCAddresses(customAddresses)

      const customUSDC = createTokenData(1, '0x1234567890123456789012345678901234567890')
      const defaultUSDC = createTokenData(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')

      expect(CCTPLiFiRoutePlanner.isUSDC(customUSDC)).toBe(true)
      expect(CCTPLiFiRoutePlanner.isUSDC(defaultUSDC)).toBe(false)
    })

    it('should preserve immutability of addresses', () => {
      const addresses = CCTPLiFiRoutePlanner.getUSDCAddresses()
      addresses[1] = '0xModified' as Hex

      // Original should remain unchanged
      expect(CCTPLiFiRoutePlanner.getUSDCAddress(1)).toBe(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      )
    })
  })

  describe('Error handling', () => {
    it('should throw error for unsupported chain', () => {
      expect(() => CCTPLiFiRoutePlanner.getUSDCAddress(999)).toThrow(
        'USDC address not found for chain 999',
      )
    })

    it('should return false for unsupported chain validation', () => {
      expect(CCTPLiFiRoutePlanner.validateCCTPSupport(1, 999)).toBe(false)
      expect(CCTPLiFiRoutePlanner.validateCCTPSupport(999, 1)).toBe(false)
    })
  })

  describe('Reset functionality', () => {
    it('should reset to default addresses', () => {
      // Update with custom addresses
      CCTPLiFiRoutePlanner.updateUSDCAddresses({
        1: '0x1234567890123456789012345678901234567890' as Hex,
      })

      expect(CCTPLiFiRoutePlanner.getUSDCAddress(1)).toBe(
        '0x1234567890123456789012345678901234567890',
      )

      // Reset to defaults
      CCTPLiFiRoutePlanner.resetToDefaults()

      expect(CCTPLiFiRoutePlanner.getUSDCAddress(1)).toBe(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      )
    })
  })
})
