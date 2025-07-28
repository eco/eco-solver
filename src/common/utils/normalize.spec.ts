import { Hex } from 'viem'
import { convertNormalize, deconvertNormalize, BASE_DECIMALS } from './normalize'

describe('Normalize Utils', () => {
  describe('convertNormalize', () => {
    it('should normalize the output', () => {
      const orig = { chainID: 1n, address: '0x' as Hex, decimals: 6 }
      expect(convertNormalize(100n, orig)).toEqual({ balance: 100n, ...orig })
      const second = { chainID: 1n, address: '0x' as Hex, decimals: 4 }
      expect(convertNormalize(100n, second)).toEqual({
        balance: 10000n,
        ...second,
        decimals: 6,
      })
    })

    it('should change the decimals to the normalized value', () => {
      const second = { chainID: 1n, address: '0x' as Hex, decimals: 4 }
      expect(convertNormalize(100n, second)).toEqual({
        balance: 10000n,
        ...second,
        decimals: 6,
      })
    })

    it('should handle tokens with more decimals than BASE_DECIMALS', () => {
      const token = { chainID: 1n, address: '0x' as Hex, decimals: 18 }
      // 1e18 (1 token with 18 decimals) should become 1e6 (1 token with 6 decimals)
      expect(convertNormalize(1000000000000000000n, token)).toEqual({
        balance: 1000000n,
        ...token,
        decimals: BASE_DECIMALS,
      })
    })

    it('should handle zero values', () => {
      const token = { chainID: 1n, address: '0x' as Hex, decimals: 8 }
      expect(convertNormalize(0n, token)).toEqual({
        balance: 0n,
        ...token,
        decimals: BASE_DECIMALS,
      })
    })
  })

  describe('deconvertNormalize', () => {
    it('should denormalize the output', () => {
      const orig = { chainID: 1n, address: '0x' as Hex, decimals: 6 }
      expect(deconvertNormalize(100n, orig)).toBe(100n)
      const second = { chainID: 1n, address: '0x' as Hex, decimals: 4 }
      expect(deconvertNormalize(100n, second)).toBe(1n)
    })

    it('should handle tokens with more decimals than BASE_DECIMALS', () => {
      const token = { chainID: 1n, address: '0x' as Hex, decimals: 18 }
      // 1e6 (1 token with 6 decimals) should become 1e18 (1 token with 18 decimals)
      expect(deconvertNormalize(1000000n, token)).toBe(1000000000000000000n)
    })

    it('should handle zero values', () => {
      const token = { chainID: 1n, address: '0x' as Hex, decimals: 8 }
      expect(deconvertNormalize(0n, token)).toBe(0n)
    })

    it('should properly round down when converting to fewer decimals', () => {
      const token = { chainID: 1n, address: '0x' as Hex, decimals: 4 }
      // 99n with 6 decimals should become 0n with 4 decimals (rounds down)
      expect(deconvertNormalize(99n, token)).toBe(0n)
      // 100n with 6 decimals should become 1n with 4 decimals
      expect(deconvertNormalize(100n, token)).toBe(1n)
    })
  })
})
