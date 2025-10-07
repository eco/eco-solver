import { Hex } from 'viem'
import { USDT0LiFiRoutePlanner } from './route-planner'
import { TokenData } from '@/liquidity-manager/types/types'

describe('USDT0LiFiRoutePlanner', () => {
  const usdtMap: Record<number, Hex> = {
    1: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as Hex, // ETH USDT
    10: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58' as Hex, // OP USDT
  }

  const token = (chainId: number, address: Hex): TokenData =>
    ({
      chainId,
      config: { address, chainId, minBalance: 0, targetBalance: 0, type: 'erc20' },
      balance: { address, decimals: 6, balance: 0n },
    }) as any

  beforeEach(() => {
    USDT0LiFiRoutePlanner.updateUSDTAddresses(usdtMap)
  })

  it('plans TOKEN → TOKEN as [sourceSwap, usdt0Bridge, destinationSwap]', () => {
    const tIn = token(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Hex) // USDC (not USDT)
    const tOut = token(10, '0x4200000000000000000000000000000000000042' as Hex)
    const steps = USDT0LiFiRoutePlanner.planRoute(tIn, tOut)
    expect(steps.map((s) => s.type)).toEqual(['sourceSwap', 'usdt0Bridge', 'destinationSwap'])
  })

  it('plans USDT → TOKEN as [usdt0Bridge, destinationSwap]', () => {
    const tIn = token(1, usdtMap[1])
    const tOut = token(10, '0x4200000000000000000000000000000000000042' as Hex)
    const steps = USDT0LiFiRoutePlanner.planRoute(tIn, tOut)
    expect(steps.map((s) => s.type)).toEqual(['usdt0Bridge', 'destinationSwap'])
  })

  it('plans TOKEN → USDT as [sourceSwap, usdt0Bridge]', () => {
    const tIn = token(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Hex)
    const tOut = token(10, usdtMap[10])
    const steps = USDT0LiFiRoutePlanner.planRoute(tIn, tOut)
    expect(steps.map((s) => s.type)).toEqual(['sourceSwap', 'usdt0Bridge'])
  })

  it('plans USDT → USDT as [usdt0Bridge]', () => {
    const tIn = token(1, usdtMap[1])
    const tOut = token(10, usdtMap[10])
    const steps = USDT0LiFiRoutePlanner.planRoute(tIn, tOut)
    expect(steps.map((s) => s.type)).toEqual(['usdt0Bridge'])
  })

  it('validateUSDT0Support returns false for unsupported chains', () => {
    expect(USDT0LiFiRoutePlanner.validateUSDT0Support(1, 999)).toBe(false)
  })
})
