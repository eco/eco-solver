import { getSlippage } from './math'

describe('getSlippage', () => {
  it('should return 0 when fromAmount is 0', () => {
    const slippage = getSlippage('100', '0')
    expect(slippage).toBe(0)
  })

  it('should calculate slippage correctly for standard numbers', () => {
    // (1000 - 995) / 1000 = 0.005
    const slippage = getSlippage('995', '1000')
    expect(slippage).toBe(0.005)
  })

  it('should return 0 when toAmountMin equals fromAmount', () => {
    const slippage = getSlippage('1000', '1000')
    expect(slippage).toBe(0)
  })

  it('should handle large numbers without loss of precision', () => {
    const fromAmount = '100000000000000000000' // 100 ETH in wei
    const toAmountMin = '99500000000000000000' // 99.5 ETH in wei
    const slippage = getSlippage(toAmountMin, fromAmount)
    expect(slippage).toBe(0.005)
  })

  it('should handle very large numbers that would overflow standard Number', () => {
    const fromAmount = '90071992547409930000' // Larger than MAX_SAFE_INTEGER
    const toAmountMin = '90062985348155189007' // Represents a 0.01% slippage
    const slippage = getSlippage(toAmountMin, fromAmount)
    // Using toBeCloseTo for floating point comparison
    expect(slippage).toBeCloseTo(0.0001)
  })

  it('should calculate slippage with several decimal places correctly', () => {
    // (100000 - 99370) / 100000 = 0.0063
    const fromAmount = '100000'
    const toAmountMin = '99370'
    const slippage = getSlippage(toAmountMin, fromAmount)
    expect(slippage).toBe(0.0063)
  })

  it('should return 1 for 100% slippage if toAmountMin is 0', () => {
    const slippage = getSlippage('0', '1000')
    expect(slippage).toBe(1)
  })
})
