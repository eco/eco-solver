import { CCIPLiFiRoutePlanner } from './route-planner'
import { TokenData } from '@/liquidity-manager/types/types'
import { Hex } from 'viem'

describe('CCIPLiFiRoutePlanner', () => {
  const bridgeTokens = {
    1: { USDC: '0x0000000000000000000000000000000000000001' as Hex },
    10: { USDC: '0x000000000000000000000000000000000000000A' as Hex },
  }

  beforeEach(() => {
    CCIPLiFiRoutePlanner.updateBridgeTokens(bridgeTokens)
  })

  const makeTokenData = (chainId: number, address: string, decimals = 18): TokenData =>
    ({
      chainId,
      config: { address: address as Hex, chainId, minBalance: 0, targetBalance: 0, type: 'erc20' },
      balance: { address: address as Hex, decimals, balance: 0n },
    }) as TokenData

  describe('planRoute', () => {
    it('returns source + bridge + destination when neither token is bridge token', () => {
      const tokenIn = makeTokenData(1, '0x1111111111111111111111111111111111111111')
      const tokenOut = makeTokenData(10, '0x2222222222222222222222222222222222222222')

      const route = CCIPLiFiRoutePlanner.planRoute(tokenIn, tokenOut)

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

      const route = CCIPLiFiRoutePlanner.planRoute(tokenIn, tokenOut)

      expect(route.steps.map((s) => s.type)).toEqual(['ccipBridge'])
    })

    it('returns bridge + destination when source is bridge token', () => {
      const tokenIn = makeTokenData(1, '0x0000000000000000000000000000000000000001')
      const tokenOut = makeTokenData(10, '0x2222222222222222222222222222222222222222')

      const route = CCIPLiFiRoutePlanner.planRoute(tokenIn, tokenOut)

      expect(route.steps.map((s) => s.type)).toEqual(['ccipBridge', 'destinationSwap'])
    })

    it('returns source + bridge when destination is bridge token', () => {
      const tokenIn = makeTokenData(1, '0x1111111111111111111111111111111111111111')
      const tokenOut = makeTokenData(10, '0x000000000000000000000000000000000000000A')

      const route = CCIPLiFiRoutePlanner.planRoute(tokenIn, tokenOut)

      expect(route.steps.map((s) => s.type)).toEqual(['sourceSwap', 'ccipBridge'])
    })
  })

  describe('validateCCIPSupport', () => {
    it('returns true when both chains have common bridge tokens', () => {
      expect(CCIPLiFiRoutePlanner.validateCCIPSupport(1, 10)).toBe(true)
    })

    it('returns false when source chain has no tokens configured', () => {
      expect(CCIPLiFiRoutePlanner.validateCCIPSupport(999, 10)).toBe(false)
    })

    it('returns false when destination chain has no tokens configured', () => {
      expect(CCIPLiFiRoutePlanner.validateCCIPSupport(1, 999)).toBe(false)
    })
  })

  describe('selectBridgeToken', () => {
    it('prefers USDC when available', () => {
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

      const bridge = CCIPLiFiRoutePlanner.selectBridgeToken(1, 10)
      expect(bridge.symbol).toBe('USDC')
    })

    it('throws when no common bridge token exists', () => {
      CCIPLiFiRoutePlanner.updateBridgeTokens({
        1: { USDC: '0x0000000000000000000000000000000000000001' as Hex },
        10: { LINK: '0x2222222222222222222222222222222222222222' as Hex },
      })

      expect(() => CCIPLiFiRoutePlanner.selectBridgeToken(1, 10)).toThrow()
    })
  })
})
