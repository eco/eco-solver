import { Test } from '@nestjs/testing'
import { AnalyticsModule, ANALYTICS_SERVICE } from '@/analytics/analytics.module'
import { AnalyticsService, AnalyticsConfig } from '@/analytics/analytics.interface'
import { PosthogService } from '@/analytics/posthog.service'

describe('AnalyticsModule', () => {
  const mockConfig: AnalyticsConfig = {
    apiKey: 'test-api-key',
    host: 'https://test.posthog.com',
    flushAt: 10,
    flushInterval: 5000,
  }

  describe('withPostHog', () => {
    it('should create module with PostHog service', async () => {
      const module = await Test.createTestingModule({
        imports: [AnalyticsModule.withPostHog(mockConfig)],
      }).compile()

      const service = module.get<AnalyticsService>(ANALYTICS_SERVICE)
      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(PosthogService)
    })

    it('should be global module', () => {
      const dynamicModule = AnalyticsModule.withPostHog(mockConfig)
      expect(dynamicModule.global).toBe(true)
    })

    it('should export analytics service', () => {
      const dynamicModule = AnalyticsModule.withPostHog(mockConfig)
      expect(dynamicModule.exports).toContain(ANALYTICS_SERVICE)
    })
  })

  describe('withConfig', () => {
    it('should create module with config factory', async () => {
      const configFactory = () => mockConfig

      const module = await Test.createTestingModule({
        imports: [AnalyticsModule.withConfig(configFactory)],
      }).compile()

      const service = module.get<AnalyticsService>(ANALYTICS_SERVICE)
      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(PosthogService)
    })

    it('should handle async config factory', async () => {
      const asyncConfigFactory = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        return mockConfig
      }

      const module = await Test.createTestingModule({
        imports: [AnalyticsModule.withConfig(asyncConfigFactory)],
      }).compile()

      const service = module.get<AnalyticsService>(ANALYTICS_SERVICE)
      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(PosthogService)
    })
  })

  describe('withAsyncConfig', () => {
    it('should create module with async config factory', async () => {
      const module = await Test.createTestingModule({
        imports: [
          AnalyticsModule.withAsyncConfig({
            useFactory: async () => {
              // Simulate async config loading
              await new Promise((resolve) => setTimeout(resolve, 1))
              return {
                apiKey: 'async-factory-key',
                host: 'https://test.posthog.com',
              }
            },
          }),
        ],
      }).compile()

      const service = module.get<AnalyticsService>(ANALYTICS_SERVICE)
      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(PosthogService)
    })

    it('should create module with sync factory in async config', async () => {
      const module = await Test.createTestingModule({
        imports: [
          AnalyticsModule.withAsyncConfig({
            useFactory: () => ({
              apiKey: 'sync-in-async-key',
              host: 'https://test.posthog.com',
            }),
          }),
        ],
      }).compile()

      const service = module.get<AnalyticsService>(ANALYTICS_SERVICE)
      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(PosthogService)
    })

    it('should work without inject array', async () => {
      const module = await Test.createTestingModule({
        imports: [
          AnalyticsModule.withAsyncConfig({
            useFactory: () => mockConfig,
          }),
        ],
      }).compile()

      const service = module.get<AnalyticsService>(ANALYTICS_SERVICE)
      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(PosthogService)
    })
  })

  describe('module configuration', () => {
    it('should have consistent structure across all factory methods', () => {
      const directModule = AnalyticsModule.withPostHog(mockConfig)
      const factoryModule = AnalyticsModule.withConfig(() => mockConfig)
      const asyncModule = AnalyticsModule.withAsyncConfig({
        useFactory: () => mockConfig,
      })

      // All should be global modules
      expect(directModule.global).toBe(true)
      expect(factoryModule.global).toBe(true)
      expect(asyncModule.global).toBe(true)

      // All should export the same service
      expect(directModule.exports).toEqual([ANALYTICS_SERVICE])
      expect(factoryModule.exports).toEqual([ANALYTICS_SERVICE])
      expect(asyncModule.exports).toEqual([ANALYTICS_SERVICE])

      // All should use the same module class
      expect(directModule.module).toBe(AnalyticsModule)
      expect(factoryModule.module).toBe(AnalyticsModule)
      expect(asyncModule.module).toBe(AnalyticsModule)
    })
  })
})
