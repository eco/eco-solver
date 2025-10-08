import { Hex } from 'viem'
import { TokenData } from '@/liquidity-manager/types/types'
import { USDT0LiFiRoutePlanner } from './route-planner'
import { USDT0LiFiValidator } from './validation'

describe('USDT0LiFiValidator', () => {
  const usdtMap: Record<number, Hex> = {
    1: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as Hex,
    10: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58' as Hex,
  }
  const token = (chainId: number, address: Hex): TokenData =>
    ({
      chainId,
      config: { address, chainId, minBalance: 0, targetBalance: 0, type: 'erc20' },
      balance: { address, decimals: 6, balance: 0n },
    }) as any

  beforeAll(() => {
    USDT0LiFiRoutePlanner.updateUSDTAddresses(usdtMap)
  })

  it('rejects same-chain', () => {
    const t = token(1, usdtMap[1])
    const res = USDT0LiFiValidator.validateRoute(t, t, 100, 0.05)
    expect(res.isValid).toBe(false)
  })

  it('rejects unsupported chains', () => {
    const tIn = token(1, usdtMap[1])
    const tOut = token(999, '0xdead' as Hex)
    const res = USDT0LiFiValidator.validateRoute(tIn, tOut, 100, 0.05)
    expect(res.isValid).toBe(false)
  })

  it('accepts supported cross-chain with positive amount', () => {
    const tIn = token(1, usdtMap[1])
    const tOut = token(10, usdtMap[10])
    const res = USDT0LiFiValidator.validateRoute(tIn, tOut, 100, 0.05)
    expect(res.isValid).toBe(true)
  })
})
