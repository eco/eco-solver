import * as config from 'config'
import { getNodeEnv, isPreEnv, NodeEnv } from './utils'

// Mock the config module
jest.mock('config', () => ({
  util: {
    getEnv: jest.fn(),
  },
}))

describe('eco-configs/utils', () => {
  const mockGetEnv = config.util.getEnv as jest.Mock

  beforeEach(() => {
    mockGetEnv.mockReset()
  })

  describe('getNodeEnv', () => {
    describe('exact matches', () => {
      it('should return NodeEnv.production for "production"', () => {
        mockGetEnv.mockReturnValue('production')
        expect(getNodeEnv()).toBe(NodeEnv.production)
      })

      it('should return NodeEnv.preproduction for "preproduction"', () => {
        mockGetEnv.mockReturnValue('preproduction')
        expect(getNodeEnv()).toBe(NodeEnv.preproduction)
      })

      it('should return NodeEnv.staging for "staging"', () => {
        mockGetEnv.mockReturnValue('staging')
        expect(getNodeEnv()).toBe(NodeEnv.staging)
      })

      it('should return NodeEnv.development for "development"', () => {
        mockGetEnv.mockReturnValue('development')
        expect(getNodeEnv()).toBe(NodeEnv.development)
      })
    })

    describe('compound environment names', () => {
      it('should return NodeEnv["green-production"] for "green-production"', () => {
        mockGetEnv.mockReturnValue('green-production')
        expect(getNodeEnv()).toBe(NodeEnv['green-production'])
      })

      it('should return NodeEnv["yellow-production"] for "yellow-production"', () => {
        mockGetEnv.mockReturnValue('yellow-production')
        expect(getNodeEnv()).toBe(NodeEnv['yellow-production'])
      })
    })

    describe('case insensitivity', () => {
      it('should handle uppercase "PRODUCTION"', () => {
        mockGetEnv.mockReturnValue('PRODUCTION')
        expect(getNodeEnv()).toBe(NodeEnv.production)
      })

      it('should handle mixed case "Green-Production"', () => {
        mockGetEnv.mockReturnValue('Green-Production')
        expect(getNodeEnv()).toBe(NodeEnv['green-production'])
      })
    })

    describe('fallback to development', () => {
      it('should return NodeEnv.development for unknown environment', () => {
        mockGetEnv.mockReturnValue('unknown-env')
        expect(getNodeEnv()).toBe(NodeEnv.development)
      })

      it('should return NodeEnv.development for empty string', () => {
        mockGetEnv.mockReturnValue('')
        expect(getNodeEnv()).toBe(NodeEnv.development)
      })
    })
  })

  describe('isPreEnv', () => {
    describe('should return true for pre-production environments', () => {
      it('returns true for development', () => {
        mockGetEnv.mockReturnValue('development')
        expect(isPreEnv()).toBe(true)
      })

      it('returns true for preproduction', () => {
        mockGetEnv.mockReturnValue('preproduction')
        expect(isPreEnv()).toBe(true)
      })

      it('returns true for staging', () => {
        mockGetEnv.mockReturnValue('staging')
        expect(isPreEnv()).toBe(true)
      })
    })

    describe('should return false for production environments', () => {
      it('returns false for production', () => {
        mockGetEnv.mockReturnValue('production')
        expect(isPreEnv()).toBe(false)
      })

      it('returns false for green-production', () => {
        mockGetEnv.mockReturnValue('green-production')
        expect(isPreEnv()).toBe(false)
      })

      it('returns false for yellow-production', () => {
        mockGetEnv.mockReturnValue('yellow-production')
        expect(isPreEnv()).toBe(false)
      })
    })
  })
})
