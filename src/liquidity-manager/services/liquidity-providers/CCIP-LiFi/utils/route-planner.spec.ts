import { CCIPLiFiRoutePlanner, CCIPRouteValidator, BridgeTokenInfo } from './route-planner'
import { TokenData } from '@/liquidity-manager/types/types'
import { Hex } from 'viem'

describe('CCIPLiFiRoutePlanner', () => {
  const bridgeTokens = {
    1: { USDC: '0x0000000000000000000000000000000000000001' as Hex },
    10: { USDC: '0x000000000000000000000000000000000000000A' as Hex },
  }

  const usdcBridgeToken: BridgeTokenInfo = {
    symbol: 'USDC',
    sourceAddress: '0x0000000000000000000000000000000000000001' as Hex,
    destinationAddress: '0x000000000000000000000000000000000000000A' as Hex,
  }

  // Validator that allows all routes
  const allowAllValidator: CCIPRouteValidator = async () => true

  // Validator that denies all routes
  const denyAllValidator: CCIPRouteValidator = async () => false

  beforeEach(() => {
    CCIPLiFiRoutePlanner.updateBridgeTokens(bridgeTokens)
  })

  const makeTokenData = (chainId: number, address: string, decimals = 18): TokenData =>
    ({
      chainId,
      config: { address: address as Hex, chainId, minBalance: 0, targetBalance: 0, type: 'erc20' },
      balance: { address: address as Hex, decimals, balance: 0n },
    }) as TokenData

  describe('getCommonBridgeTokens', () => {
    it('returns common symbols between two chains', () => {
      CCIPLiFiRoutePlanner.updateBridgeTokens({
        1: { USDC: '0x1' as Hex, LINK: '0x2' as Hex },
        10: { USDC: '0xA' as Hex, WETH: '0xB' as Hex },
      })

      const common = CCIPLiFiRoutePlanner.getCommonBridgeTokens(1, 10)
      expect(common).toEqual(['USDC'])
    })

    it('returns empty array when no common tokens', () => {
      CCIPLiFiRoutePlanner.updateBridgeTokens({
        1: { USDC: '0x1' as Hex },
        10: { LINK: '0xA' as Hex },
      })

      const common = CCIPLiFiRoutePlanner.getCommonBridgeTokens(1, 10)
      expect(common).toEqual([])
    })
  })

  describe('planRoute', () => {
    it('returns source + bridge + destination when neither token is bridge token', () => {
      const tokenIn = makeTokenData(1, '0x1111111111111111111111111111111111111111')
      const tokenOut = makeTokenData(10, '0x2222222222222222222222222222222222222222')

      const route = CCIPLiFiRoutePlanner.planRoute(tokenIn, tokenOut, usdcBridgeToken)

      expect(route.steps.map((s) => s.type)).toEqual([
        'sourceSwap',
        'ccipBridge',
        'destinationSwap',
      ])
      expect(route.bridgeToken.symbol).toBe('USDC')
      expect(route.bridgeToken.sourceAddress).toBe('0x0000000000000000000000000000000000000001')
    })

    it('returns only bridge when source is bridge token and dest is bridge token', () => {
      const tokenIn = makeTokenData(1, '0x0000000000000000000000000000000000000001')
      const tokenOut = makeTokenData(10, '0x000000000000000000000000000000000000000A')

      const route = CCIPLiFiRoutePlanner.planRoute(tokenIn, tokenOut, usdcBridgeToken)

      expect(route.steps.map((s) => s.type)).toEqual(['ccipBridge'])
    })

    it('returns bridge + destination when source is bridge token', () => {
      const tokenIn = makeTokenData(1, '0x0000000000000000000000000000000000000001')
      const tokenOut = makeTokenData(10, '0x2222222222222222222222222222222222222222')

      const route = CCIPLiFiRoutePlanner.planRoute(tokenIn, tokenOut, usdcBridgeToken)

      expect(route.steps.map((s) => s.type)).toEqual(['ccipBridge', 'destinationSwap'])
    })

    it('returns source + bridge when destination is bridge token', () => {
      const tokenIn = makeTokenData(1, '0x1111111111111111111111111111111111111111')
      const tokenOut = makeTokenData(10, '0x000000000000000000000000000000000000000A')

      const route = CCIPLiFiRoutePlanner.planRoute(tokenIn, tokenOut, usdcBridgeToken)

      expect(route.steps.map((s) => s.type)).toEqual(['sourceSwap', 'ccipBridge'])
    })
  })

  describe('validateCCIPSupportAsync', () => {
    it('returns true when validator allows the route', async () => {
      const result = await CCIPLiFiRoutePlanner.validateCCIPSupportAsync(1, 10, allowAllValidator)
      expect(result).toBe(true)
    })

    it('returns false when validator denies the route', async () => {
      const result = await CCIPLiFiRoutePlanner.validateCCIPSupportAsync(1, 10, denyAllValidator)
      expect(result).toBe(false)
    })

    it('returns false when source chain has no tokens configured', async () => {
      const result = await CCIPLiFiRoutePlanner.validateCCIPSupportAsync(999, 10, allowAllValidator)
      expect(result).toBe(false)
    })

    it('returns false when destination chain has no tokens configured', async () => {
      const result = await CCIPLiFiRoutePlanner.validateCCIPSupportAsync(1, 999, allowAllValidator)
      expect(result).toBe(false)
    })

    it('returns true if at least one token passes validation', async () => {
      CCIPLiFiRoutePlanner.updateBridgeTokens({
        1: {
          USDC: '0x0000000000000000000000000000000000000001' as Hex,
          LINK: '0x1111111111111111111111111111111111111111' as Hex,
        },
        10: {
          USDC: '0x000000000000000000000000000000000000000A' as Hex,
          LINK: '0x2222222222222222222222222222222222222222' as Hex,
        },
      })

      // Validator that only allows LINK
      const linkOnlyValidator: CCIPRouteValidator = async (_, __, tokenSymbol) =>
        tokenSymbol === 'LINK'

      const result = await CCIPLiFiRoutePlanner.validateCCIPSupportAsync(1, 10, linkOnlyValidator)
      expect(result).toBe(true)
    })
  })

  describe('selectBridgeTokenAsync', () => {
    it('prefers USDC when available and validator allows it', async () => {
      CCIPLiFiRoutePlanner.updateBridgeTokens({
        1: {
          LINK: '0x1111111111111111111111111111111111111111' as Hex,
          USDC: '0x0000000000000000000000000000000000000001' as Hex,
        },
        10: {
          LINK: '0x2222222222222222222222222222222222222222' as Hex,
          USDC: '0x000000000000000000000000000000000000000A' as Hex,
        },
      })

      const bridge = await CCIPLiFiRoutePlanner.selectBridgeTokenAsync(1, 10, allowAllValidator)
      expect(bridge.symbol).toBe('USDC')
    })

    it('throws when no common bridge token exists', async () => {
      CCIPLiFiRoutePlanner.updateBridgeTokens({
        1: { USDC: '0x0000000000000000000000000000000000000001' as Hex },
        10: { LINK: '0x2222222222222222222222222222222222222222' as Hex },
      })

      await expect(
        CCIPLiFiRoutePlanner.selectBridgeTokenAsync(1, 10, allowAllValidator),
      ).rejects.toThrow('CCIPLiFi: No common bridge token between chains 1 and 10')
    })

    it('throws when common token exists but validator denies it', async () => {
      await expect(
        CCIPLiFiRoutePlanner.selectBridgeTokenAsync(1, 10, denyAllValidator),
      ).rejects.toThrow('CCIPLiFi: No supported bridge token between chains 1 and 10')
    })

    it('falls back to another token when USDC is denied by validator', async () => {
      CCIPLiFiRoutePlanner.updateBridgeTokens({
        1: {
          USDC: '0x0000000000000000000000000000000000000001' as Hex,
          LINK: '0x1111111111111111111111111111111111111111' as Hex,
        },
        10: {
          USDC: '0x000000000000000000000000000000000000000A' as Hex,
          LINK: '0x2222222222222222222222222222222222222222' as Hex,
        },
      })

      // Validator that denies USDC but allows LINK
      const noUsdcValidator: CCIPRouteValidator = async (_, __, tokenSymbol) =>
        tokenSymbol !== 'USDC'

      const bridge = await CCIPLiFiRoutePlanner.selectBridgeTokenAsync(1, 10, noUsdcValidator)
      expect(bridge.symbol).toBe('LINK')
      expect(bridge.sourceAddress).toBe('0x1111111111111111111111111111111111111111')
      expect(bridge.destinationAddress).toBe('0x2222222222222222222222222222222222222222')
    })
  })
})
