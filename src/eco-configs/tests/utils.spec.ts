const mockRoutes = {
  EcoProtocolAddresses: {
    '10': { name: 'prod' },
    '10-staging': { name: 'preprod' },
    '84523': { name: 'staging' },
    '84523-staging': { name: 'development' },
  },
}
import { getNodeEnv, isPreEnv, getChainConfig, NodeEnv, ChainPrefix } from '../utils'
import { EcoError } from '../../common/errors/eco-error'
import * as config from 'config'

jest.mock('config')

jest.mock('@eco-foundation/routes-ts-v2', () => mockRoutes)

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

      // config.util.getEnv = jest.fn().mockReturnValue('preproduction')
      // expect(getChainConfig(10)).toEqual(mockRoutes.EcoProtocolAddresses['10-staging'])

      config.util.getEnv = jest.fn().mockReturnValue('staging')
      expect(getChainConfig(84523)).toEqual(mockRoutes.EcoProtocolAddresses['84523-staging'])

      config.util.getEnv = jest.fn().mockReturnValue('development')
      expect(getChainConfig(84523)).toEqual(mockRoutes.EcoProtocolAddresses['84523-staging'])
    })

    it('should throw an error if the chain configuration is not found', () => {
      config.util.getEnv = jest.fn().mockReturnValue('production')
      expect(() => getChainConfig(3)).toThrow(EcoError.ChainConfigNotFound('3'))

      config.util.getEnv = jest.fn().mockReturnValue('preproduction')
      expect(() => getChainConfig(4)).toThrow(EcoError.ChainConfigNotFound('4-staging'))

      config.util.getEnv = jest.fn().mockReturnValue('staging')
      expect(() => getChainConfig(3)).toThrow(EcoError.ChainConfigNotFound('3-staging'))

      config.util.getEnv = jest.fn().mockReturnValue('development')
      expect(() => getChainConfig(4)).toThrow(EcoError.ChainConfigNotFound('4-staging'))
    })
  })
})
