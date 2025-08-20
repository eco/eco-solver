const mockRoutes = {
  EcoProtocolAddresses: {
    '10': { name: 'prod' },
    '10-pre': { name: 'preprod' },
    '84523': { name: 'staging' },
    '84523-pre': { name: 'development' },
  },
}
import { getNodeEnv, isPreEnv, getChainConfig, NodeEnv, ChainPrefix } from '../utils'
import { EcoError } from '../../common/errors/eco-error'

jest.mock('@eco-foundation/routes-ts', () => mockRoutes)

describe('config utils tests', () => {
  describe('on getNodeEnv', () => {
    it('should return the correct NodeEnv value', () => {
      process.env.NODE_ENV = 'production'
      expect(getNodeEnv()).toBe(NodeEnv.production)

      process.env.NODE_ENV = 'preproduction'
      expect(getNodeEnv()).toBe(NodeEnv.preproduction)

      process.env.NODE_ENV = 'staging'
      expect(getNodeEnv()).toBe(NodeEnv.staging)

      process.env.NODE_ENV = 'development'
      expect(getNodeEnv()).toBe(NodeEnv.development)

      process.env.NODE_ENV = 'unknown'
      expect(getNodeEnv()).toBe(NodeEnv.development)
    })
  })

  describe('on isPreEnv', () => {
    it('should return true if the environment is pre', () => {
      process.env.NODE_ENV = 'preproduction'
      expect(isPreEnv()).toBe(true)

      process.env.NODE_ENV = 'development'
      expect(isPreEnv()).toBe(true)
    })

    it('should return false if the environment is not pre', () => {
      process.env.NODE_ENV = 'production'
      expect(isPreEnv()).toBe(false)

      process.env.NODE_ENV = 'staging'
      expect(isPreEnv()).toBe(true)
    })
  })

  describe('on getChainConfig', () => {
    it('should return the correct chain configuration', () => {
      process.env.NODE_ENV = 'production'
      expect(getChainConfig(10)).toEqual(mockRoutes.EcoProtocolAddresses['10'])

      process.env.NODE_ENV = 'preproduction'
      expect(getChainConfig(10)).toEqual(mockRoutes.EcoProtocolAddresses['10-pre'])

      process.env.NODE_ENV = 'staging'
      expect(getChainConfig(84523)).toEqual(mockRoutes.EcoProtocolAddresses['84523-pre'])

      process.env.NODE_ENV = 'development'
      expect(getChainConfig(84523)).toEqual(mockRoutes.EcoProtocolAddresses['84523-pre'])
    })

    it('should throw an error if the chain configuration is not found', () => {
      process.env.NODE_ENV = 'production'
      expect(() => getChainConfig(3)).toThrow(EcoError.ChainConfigNotFound('3'))

      process.env.NODE_ENV = 'preproduction'
      expect(() => getChainConfig(4)).toThrow(EcoError.ChainConfigNotFound('4-pre'))

      process.env.NODE_ENV = 'staging'
      expect(() => getChainConfig(3)).toThrow(EcoError.ChainConfigNotFound('3-pre'))

      process.env.NODE_ENV = 'development'
      expect(() => getChainConfig(4)).toThrow(EcoError.ChainConfigNotFound('4-pre'))
    })
  })
})
