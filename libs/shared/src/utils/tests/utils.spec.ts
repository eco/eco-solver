import { isHex, getSelectorHash } from '../utils'

describe('Decoder Utils Test', () => {
  const data =
    '0xa9059cbb000000000000000000000000cd80b973e7cbb93c21cc5ac0a5f45d12a32582aa00000000000000000000000000000000000000000000000000000000000004d2'

  describe('isHex', () => {
    it('should return false if the input is not hex', () => {
      expect(isHex('16')).toEqual(false)
      expect(isHex('0xqw')).toEqual(false)
    })

    it('should return true if the input is hex', () => {
      expect(isHex(data)).toEqual(true)
      expect(isHex('0xab')).toEqual(true)
    })
  })
  describe('getSelectorHash', () => {
    it('should return throw if the input is empty', () => {
      expect(() => getSelectorHash(undefined)).toThrow('Data is too short')
      expect(() => getSelectorHash('')).toThrow('Data is too short')
    })

    it('should return throw if the input is not long engough', () => {
      expect(() => getSelectorHash('0x')).toThrow('Data is too short')
    })

    it('should return throw if the input is not hex', () => {
      expect(() => getSelectorHash('adsfasdfasdfadfccdx')).toThrow('Data is not hex encoded')
    })

    it('should return the first 4 bytes', () => {
      expect(getSelectorHash(data)).toEqual('0xa9059cbb')
    })
  })
})
