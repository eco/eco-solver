import { Test } from '@nestjs/testing'
import { AnalyticsModule } from '@/analytics/analytics.module'
import { ANALYTICS_SERVICE } from '@/analytics/constants'
import { AnalyticsService, AnalyticsConfig } from '@/analytics/analytics.interface'
import { PosthogService } from '@/analytics/posthog.service'
import { EcoAnalyticsService } from '@/analytics/eco-analytics.service'
import { createMock } from '@golevelup/ts-jest'

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
      })
        .overrideProvider(EcoAnalyticsService)
        .useValue(createMock<EcoAnalyticsService>())
        .compile()

      const service = module.get<AnalyticsService>(ANALYTICS_SERVICE)
      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(PosthogService)

      const ecoAnalyticsService = module.get<EcoAnalyticsService>(EcoAnalyticsService)
      expect(ecoAnalyticsService).toBeDefined()
    })

    it('should be global module', () => {
      const dynamicModule = AnalyticsModule.withPostHog(mockConfig)
      expect(dynamicModule.global).toBe(true)
    })

    it('should export analytics service', () => {
      const dynamicModule = AnalyticsModule.withPostHog(mockConfig)
      expect(dynamicModule.exports).toContain(ANALYTICS_SERVICE)
      expect(dynamicModule.exports).toContain(EcoAnalyticsService)
    })
  })

  describe('withConfig', () => {
    it('should create module with config factory', async () => {
      const configFactory = () => mockConfig

      const module = await Test.createTestingModule({
        imports: [AnalyticsModule.withConfig(configFactory)],
      })
        .overrideProvider(EcoAnalyticsService)
        .useValue(createMock<EcoAnalyticsService>())
        .compile()

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
      })
        .overrideProvider(EcoAnalyticsService)
        .useValue(createMock<EcoAnalyticsService>())
        .compile()

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
      })
        .overrideProvider(EcoAnalyticsService)
        .useValue(createMock<EcoAnalyticsService>())
        .compile()

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
      })
        .overrideProvider(EcoAnalyticsService)
        .useValue(createMock<EcoAnalyticsService>())
        .compile()

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
      })
        .overrideProvider(EcoAnalyticsService)
        .useValue(createMock<EcoAnalyticsService>())
        .compile()

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

      // All should export the same services
      expect(directModule.exports).toEqual([ANALYTICS_SERVICE, EcoAnalyticsService])
      expect(factoryModule.exports).toEqual([ANALYTICS_SERVICE, EcoAnalyticsService])
      expect(asyncModule.exports).toEqual([ANALYTICS_SERVICE, EcoAnalyticsService])

      // All should use the same module class
      expect(directModule.module).toBe(AnalyticsModule)
      expect(factoryModule.module).toBe(AnalyticsModule)
      expect(asyncModule.module).toBe(AnalyticsModule)
    })
  })
})
