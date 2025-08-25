const mockRoutes = {
  EcoProtocolAddresses: {
    '10': { name: 'prod' },
    '10-pre': { name: 'preprod' },
    '84523': { name: 'staging' },
    '84523-pre': { name: 'development' },
  },
}
import {
  getNodeEnv,
  isPreEnv,
  getChainConfig,
  NodeEnv,
  ChainPrefix,
  recursiveConvertByKeys,
  recursiveConfigNormalizer,
} from '../utils'
import { EcoError } from '../../common/errors/eco-error'
import * as config from 'config'

jest.mock('config')

jest.mock('@eco-foundation/routes-ts', () => mockRoutes)

describe('config utils tests', () => {
  describe('on getNodeEnv', () => {
    it('should return the correct NodeEnv value', () => {
      config.util.getEnv = jest.fn().mockReturnValue('production')
      expect(getNodeEnv()).toBe(NodeEnv.production)

      config.util.getEnv = jest.fn().mockReturnValue('preproduction')
      expect(getNodeEnv()).toBe(NodeEnv.preproduction)

      config.util.getEnv = jest.fn().mockReturnValue('staging')
      expect(getNodeEnv()).toBe(NodeEnv.staging)

      config.util.getEnv = jest.fn().mockReturnValue('development')
      expect(getNodeEnv()).toBe(NodeEnv.development)

      config.util.getEnv = jest.fn().mockReturnValue('unknown')
      expect(getNodeEnv()).toBe(NodeEnv.development)
    })
  })

  describe('on isPreEnv', () => {
    it('should return true if the environment is pre', () => {
      config.util.getEnv = jest.fn().mockReturnValue('preproduction')
      expect(isPreEnv()).toBe(true)

      config.util.getEnv = jest.fn().mockReturnValue('development')
      expect(isPreEnv()).toBe(true)
    })

    it('should return false if the environment is not pre', () => {
      config.util.getEnv = jest.fn().mockReturnValue('production')
      expect(isPreEnv()).toBe(false)

      config.util.getEnv = jest.fn().mockReturnValue('staging')
      expect(isPreEnv()).toBe(true)
    })
  })

  describe('on getChainConfig', () => {
    it('should return the correct chain configuration', () => {
      config.util.getEnv = jest.fn().mockReturnValue('production')
      expect(getChainConfig(10)).toEqual(mockRoutes.EcoProtocolAddresses['10'])

      config.util.getEnv = jest.fn().mockReturnValue('preproduction')
      expect(getChainConfig(10)).toEqual(mockRoutes.EcoProtocolAddresses['10-pre'])

      config.util.getEnv = jest.fn().mockReturnValue('staging')
      expect(getChainConfig(84523)).toEqual(mockRoutes.EcoProtocolAddresses['84523-pre'])

      config.util.getEnv = jest.fn().mockReturnValue('development')
      expect(getChainConfig(84523)).toEqual(mockRoutes.EcoProtocolAddresses['84523-pre'])
    })

    it('should throw an error if the chain configuration is not found', () => {
      config.util.getEnv = jest.fn().mockReturnValue('production')
      expect(() => getChainConfig(3)).toThrow(EcoError.ChainConfigNotFound('3'))

      config.util.getEnv = jest.fn().mockReturnValue('preproduction')
      expect(() => getChainConfig(4)).toThrow(EcoError.ChainConfigNotFound('4-pre'))

      config.util.getEnv = jest.fn().mockReturnValue('staging')
      expect(() => getChainConfig(3)).toThrow(EcoError.ChainConfigNotFound('3-pre'))

      config.util.getEnv = jest.fn().mockReturnValue('development')
      expect(() => getChainConfig(4)).toThrow(EcoError.ChainConfigNotFound('4-pre'))
    })
  })

  describe('on recursiveConvertByKeys', () => {
    const mockConverter = jest.fn((value, key) => {
      if (key === 'targetKey') {
        return value * 2
      }
      if (key === 'stringKey') {
        return value.toUpperCase()
      }
      if (key === 'divideKey') {
        return value / 1000
      }
      return value
    })

    beforeEach(() => {
      mockConverter.mockClear()
    })

    it('should handle null and undefined values', () => {
      const keySet = new Set(['targetKey'])

      expect(recursiveConvertByKeys(null, keySet, mockConverter)).toBe(null)
      expect(recursiveConvertByKeys(undefined, keySet, mockConverter)).toBe(undefined)
      expect(mockConverter).not.toHaveBeenCalled()
    })

    it('should handle primitive values', () => {
      const keySet = new Set(['targetKey'])

      expect(recursiveConvertByKeys(42, keySet, mockConverter)).toBe(42)
      expect(recursiveConvertByKeys('hello', keySet, mockConverter)).toBe('hello')
      expect(recursiveConvertByKeys(true, keySet, mockConverter)).toBe(true)
      expect(mockConverter).not.toHaveBeenCalled()
    })

    it('should convert values with matching keys in simple objects', () => {
      const keySet = new Set(['targetKey', 'stringKey'])
      const input = {
        targetKey: 10,
        stringKey: 'hello',
        otherKey: 'unchanged',
      }

      const result = recursiveConvertByKeys(input, keySet, mockConverter)

      expect(result).toEqual({
        targetKey: 20, // 10 * 2
        stringKey: 'HELLO', // 'hello'.toUpperCase()
        otherKey: 'unchanged',
      })
      expect(mockConverter).toHaveBeenCalledWith(10, 'targetKey')
      expect(mockConverter).toHaveBeenCalledWith('hello', 'stringKey')
      expect(mockConverter).toHaveBeenCalledTimes(2)
    })

    it('should handle nested objects', () => {
      const keySet = new Set(['targetKey'])
      const input = {
        level1: {
          targetKey: 5,
          level2: {
            targetKey: 8,
            normalKey: 'unchanged',
          },
        },
        otherData: 'unchanged',
      }

      const result = recursiveConvertByKeys(input, keySet, mockConverter)

      expect(result).toEqual({
        level1: {
          targetKey: 10, // 5 * 2
          level2: {
            targetKey: 16, // 8 * 2
            normalKey: 'unchanged',
          },
        },
        otherData: 'unchanged',
      })
      expect(mockConverter).toHaveBeenCalledWith(5, 'targetKey')
      expect(mockConverter).toHaveBeenCalledWith(8, 'targetKey')
      expect(mockConverter).toHaveBeenCalledTimes(2)
    })

    it('should handle arrays with objects', () => {
      const keySet = new Set(['targetKey'])
      const input = {
        items: [
          { targetKey: 3, name: 'item1' },
          { targetKey: 7, name: 'item2' },
          { normalKey: 'no conversion', name: 'item3' },
        ],
      }

      const result = recursiveConvertByKeys(input, keySet, mockConverter)

      expect(result).toEqual({
        items: [
          { targetKey: 6, name: 'item1' }, // 3 * 2
          { targetKey: 14, name: 'item2' }, // 7 * 2
          { normalKey: 'no conversion', name: 'item3' },
        ],
      })
      expect(mockConverter).toHaveBeenCalledWith(3, 'targetKey')
      expect(mockConverter).toHaveBeenCalledWith(7, 'targetKey')
      expect(mockConverter).toHaveBeenCalledTimes(2)
    })

    it('should handle arrays of primitives', () => {
      const keySet = new Set(['targetKey'])
      const input = {
        numbers: [1, 2, 3],
        strings: ['a', 'b', 'c'],
      }

      const result = recursiveConvertByKeys(input, keySet, mockConverter)

      expect(result).toEqual({
        numbers: [1, 2, 3],
        strings: ['a', 'b', 'c'],
      })
      expect(mockConverter).not.toHaveBeenCalled()
    })

    it('should handle mixed nested structures', () => {
      const keySet = new Set(['divideKey', 'targetKey'])
      const input = {
        config: {
          limits: {
            divideKey: 5000000,
            targetKey: 100,
          },
          chains: [
            {
              id: 1,
              divideKey: 2000000,
              settings: {
                targetKey: 50,
              },
            },
            {
              id: 2,
              normalValue: 'unchanged',
            },
          ],
        },
      }

      const result = recursiveConvertByKeys(input, keySet, mockConverter)

      expect(result).toEqual({
        config: {
          limits: {
            divideKey: 5000, // 5000000 / 1000
            targetKey: 200, // 100 * 2
          },
          chains: [
            {
              id: 1,
              divideKey: 2000, // 2000000 / 1000
              settings: {
                targetKey: 100, // 50 * 2
              },
            },
            {
              id: 2,
              normalValue: 'unchanged',
            },
          ],
        },
      })
      expect(mockConverter).toHaveBeenCalledTimes(4)
    })

    it('should handle empty objects and arrays', () => {
      const keySet = new Set(['targetKey'])
      const input = {
        emptyObj: {},
        emptyArray: [],
        nested: {
          emptyNested: {},
        },
      }

      const result = recursiveConvertByKeys(input, keySet, mockConverter)

      expect(result).toEqual({
        emptyObj: {},
        emptyArray: [],
        nested: {
          emptyNested: {},
        },
      })
      expect(mockConverter).not.toHaveBeenCalled()
    })

    it('should handle objects with null/undefined nested values', () => {
      const keySet = new Set(['targetKey'])
      const input = {
        validKey: {
          targetKey: 15,
        },
        nullValue: null,
        undefinedValue: undefined,
        nested: {
          nullNested: null,
          targetKey: 25,
        },
      }

      const result = recursiveConvertByKeys(input, keySet, mockConverter)

      expect(result).toEqual({
        validKey: {
          targetKey: 30, // 15 * 2
        },
        nullValue: null,
        undefinedValue: undefined,
        nested: {
          nullNested: null,
          targetKey: 50, // 25 * 2
        },
      })
      expect(mockConverter).toHaveBeenCalledWith(15, 'targetKey')
      expect(mockConverter).toHaveBeenCalledWith(25, 'targetKey')
      expect(mockConverter).toHaveBeenCalledTimes(2)
    })

    it('should maintain object reference independence', () => {
      const keySet = new Set(['targetKey'])
      const input = {
        targetKey: 10,
        nested: {
          value: 'original',
        },
      }

      const result = recursiveConvertByKeys(input, keySet, mockConverter)

      // Modify the result
      result.nested.value = 'modified'

      // Original should be unchanged
      expect(input.nested.value).toBe('original')
      expect(result.nested.value).toBe('modified')
    })

    it('should work with real-world config transformation example', () => {
      const keySet = new Set(['tokenLimit', 'nativeLimit', 'minBalance'])
      const converter = (value: any, key: string) => {
        if (key === 'tokenLimit') {
          return value // Keep same value (key renaming handled elsewhere)
        } else if (key === 'nativeLimit') {
          return value / 1000000000000 // Remove 12 zeros
        } else if (key === 'minBalance') {
          return value * 1000000 // Add 6 zeros
        }
        return value
      }

      const input = {
        solvers: {
          '1': {
            fee: {
              limit: {
                tokenLimit: 5000000000,
                nativeLimit: 10000000000000000,
              },
            },
            targets: {
              '0x123': {
                minBalance: 75,
                targetBalance: 150,
              },
            },
          },
        },
      }

      const result = recursiveConvertByKeys(input, keySet, converter)

      expect(result).toEqual({
        solvers: {
          '1': {
            fee: {
              limit: {
                tokenLimit: 5000000000, // unchanged
                nativeLimit: 10000, // 10000000000000000 / 1000000000000
              },
            },
            targets: {
              '0x123': {
                minBalance: 75000000, // 75 * 1000000
                targetBalance: 150, // unchanged (not in keySet)
              },
            },
          },
        },
      })
    })
  })
})
