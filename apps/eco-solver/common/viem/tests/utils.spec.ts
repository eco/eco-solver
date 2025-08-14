import { addressKeys, convertBigIntsToStrings } from '../utils'
import { Chain, InvalidAddressError } from 'viem'

const mockApiKeys = { alchemy: 'alchemy', quicknode: 'quicknode' }

describe('Viem Utils', () => {
  describe('addressKeys', () => {
    const add = '0x6d9EedE368621F173E5c93384CFcCbfeE19f9609'
    const unchecksumedAdd = '0x6d9eede368621f173e5c93384cfccbfee19f9609'
    it('should return empty if the input is empty', () => {
      const result = addressKeys({})
      expect(result).toStrictEqual({})
    })

    it('should throw if a key isn`t a valid eth address', () => {
      const invalidAddress = '0x123'
      expect(() => addressKeys({ [add]: 11, [invalidAddress]: 22 })).toThrow(
        new InvalidAddressError({ address: invalidAddress }),
      )
    })

    it('should checksum all address keys in the top level of the object', () => {
      const input = { [unchecksumedAdd]: 123 }
      const result = addressKeys(input)
      expect(result).toEqual({ [add]: 123 })
    })
  })

  describe('convertBigIntsToStrings', () => {
    it('should return null if the input is null', () => {
      const result = convertBigIntsToStrings(null)
      expect(result).toBeNull()
    })

    it('should return undefined if the input is undefined', () => {
      const result = convertBigIntsToStrings(undefined)
      expect(result).toBeUndefined()
    })

    it('should convert BigInt values to strings', () => {
      const input = { a: BigInt(123), b: 456n }
      const result = convertBigIntsToStrings(input)
      expect(result).toEqual({ a: '123', b: '456' })
    })

    it('should handle nested objects with BigInt values', () => {
      const input = { a: { b: BigInt(123) } }
      const result = convertBigIntsToStrings(input)
      expect(result).toEqual({ a: { b: '123' } })
    })

    it('should handle arrays with BigInt values', () => {
      const input = [BigInt(123), 456n]
      const result = convertBigIntsToStrings(input)
      expect(result).toEqual(['123', '456'])
    })
  })
})
