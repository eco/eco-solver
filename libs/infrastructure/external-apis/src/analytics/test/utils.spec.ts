import { getCurrentEnvironment } from '../utils'

describe('Analytics Utils', () => {
  describe('getCurrentEnvironment', () => {
    const originalNodeEnv = process.env.NODE_ENV

    afterEach(() => {
      // Restore original NODE_ENV
      if (originalNodeEnv !== undefined) {
        process.env.NODE_ENV = originalNodeEnv
      } else {
        delete process.env.NODE_ENV
      }
    })

    it('should return NODE_ENV when set', () => {
      process.env.NODE_ENV = 'production'
      expect(getCurrentEnvironment()).toBe('production')

      process.env.NODE_ENV = 'staging'
      expect(getCurrentEnvironment()).toBe('staging')

      process.env.NODE_ENV = 'test'
      expect(getCurrentEnvironment()).toBe('test')
    })

    it('should return development as default when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV
      expect(getCurrentEnvironment()).toBe('development')
    })

    it('should return development as default when NODE_ENV is empty string', () => {
      process.env.NODE_ENV = ''
      expect(getCurrentEnvironment()).toBe('development')
    })

    it('should handle custom environments', () => {
      process.env.NODE_ENV = 'preproduction'
      expect(getCurrentEnvironment()).toBe('preproduction')

      process.env.NODE_ENV = 'local'
      expect(getCurrentEnvironment()).toBe('local')
    })
  })
})
