import { DynamicModule, FactoryProvider, Global, Module, Provider } from '@nestjs/common'
import { AnalyticsService, AnalyticsConfig } from '@eco-solver/analytics/analytics.interface'
import { PosthogService } from '@eco-solver/analytics/posthog.service'
import { EcoAnalyticsService } from '@eco-solver/analytics/eco-analytics.service'

/**
 * Injection token for the Analytics Service
 * Used to inject AnalyticsService instances via dependency injection
 */
export const ANALYTICS_SERVICE = 'ANALYTICS_SERVICE'

/**
 * Global Analytics Module for PostHog integration
 *
 * Provides multiple configuration methods similar to eco-configs module:
 * - withPostHog(): Direct configuration with static config object
 * - withConfig(): Configuration via factory function
 * - withAsyncConfig(): Async configuration with dependency injection
 *
 * The module is marked as @Global() so it's available throughout the application
 * without needing to import it in every module.
 *
 * @example
 * // Basic usage
 * AnalyticsModule.withPostHog({
 *   apiKey: 'your-api-key',
 *   host: 'https://us.posthog.com'
 * })
 *
 * @example
 * // Async configuration with dependencies
 * AnalyticsModule.withAsyncConfig({
 *   useFactory: (configService: EcoConfigService) => ({
 *     apiKey: configService.get('POSTHOG_API_KEY'),
 *     host: configService.get('POSTHOG_HOST'),
 *   }),
 *   inject: [EcoConfigService],
 * })
 */
@Global()
@Module({})
export class AnalyticsModule {
  /**
   * Configure analytics with a static configuration object
   *
   * @param config - PostHog configuration object with API key and options
   * @returns DynamicModule configured with PostHog service
   *
   * @example
   * AnalyticsModule.withPostHog({
   *   apiKey: 'ph_1234567890abcdef',
   *   host: 'https://us.posthog.com',
   *   flushAt: 20,
   *   flushInterval: 10000
   * })
   */
  static withPostHog(config: AnalyticsConfig): DynamicModule {
    const analyticsServiceProvider = AnalyticsModule.createPostHogProvider(config)
    const ecoAnalyticsServiceProvider = AnalyticsModule.createEcoAnalyticsProvider()
    return {
      global: true,
      module: AnalyticsModule,
      providers: [analyticsServiceProvider, ecoAnalyticsServiceProvider],
      exports: [ANALYTICS_SERVICE, EcoAnalyticsService],
    }
  }

  /**
   * Configure analytics with a factory function
   *
   * @param configFactory - Function that returns analytics configuration
   *                       Can be sync or async
   * @returns DynamicModule configured with PostHog service
   *
   * @example
   * AnalyticsModule.withConfig(() => ({
   *   apiKey: process.env.POSTHOG_API_KEY,
   *   host: process.env.POSTHOG_HOST || 'https://us.posthog.com'
   * }))
   */
  static withConfig(
    configFactory: (() => AnalyticsConfig) | (() => Promise<AnalyticsConfig>),
  ): DynamicModule {
    const analyticsServiceProvider = AnalyticsModule.createConfigFactoryProvider(configFactory)
    const ecoAnalyticsServiceProvider = AnalyticsModule.createEcoAnalyticsProvider()
    return {
      global: true,
      module: AnalyticsModule,
      providers: [analyticsServiceProvider, ecoAnalyticsServiceProvider],
      exports: [ANALYTICS_SERVICE, EcoAnalyticsService],
    }
  }

  /**
   * Configure analytics with async factory and dependency injection
   *
   * @param options - Configuration object with factory function and injectable dependencies
   * @param options.useFactory - Factory function that receives injected dependencies
   * @param options.inject - Array of tokens/services to inject into the factory
   * @returns DynamicModule configured with PostHog service
   *
   * @example
   * AnalyticsModule.withAsyncConfig({
   *   useFactory: (configService: EcoConfigService) => ({
   *     apiKey: configService.get('POSTHOG_API_KEY'),
   *     host: configService.get('POSTHOG_HOST', 'https://us.posthog.com')
   *   }),
   *   inject: [EcoConfigService],
   * })
   */
  static withAsyncConfig(options: {
    useFactory: (...args: any[]) => AnalyticsConfig | Promise<AnalyticsConfig>
    inject?: any[]
  }): DynamicModule {
    const analyticsServiceProvider = AnalyticsModule.createAsyncConfigProvider(options)
    const ecoAnalyticsServiceProvider = AnalyticsModule.createEcoAnalyticsProvider()
    return {
      global: true,
      module: AnalyticsModule,
      providers: [analyticsServiceProvider, ecoAnalyticsServiceProvider],
      exports: [ANALYTICS_SERVICE, EcoAnalyticsService],
    }
  }

  /**
   * Creates a provider for direct PostHog configuration
   *
   * @param config - Static configuration object
   * @returns Provider that creates PosthogService instance
   */
  private static createPostHogProvider(config: AnalyticsConfig): Provider {
    return {
      provide: ANALYTICS_SERVICE,
      useFactory: () => new PosthogService(config),
    }
  }

  /**
   * Creates a provider for factory-based configuration
   *
   * @param configFactory - Function that returns configuration (sync or async)
   * @returns Provider that creates PosthogService instance from factory
   */
  private static createConfigFactoryProvider(
    configFactory: (() => AnalyticsConfig) | (() => Promise<AnalyticsConfig>),
  ): Provider {
    const provider: FactoryProvider<AnalyticsService> = {
      provide: ANALYTICS_SERVICE,
      useFactory: async () => {
        const config = await configFactory()
        return new PosthogService(config)
      },
    }
    return provider
  }

  /**
   * Creates a provider for async configuration with dependency injection
   *
   * @param options - Factory options with injectable dependencies
   * @returns Provider that creates PosthogService instance with injected dependencies
   */
  private static createAsyncConfigProvider(options: {
    useFactory: (...args: any[]) => AnalyticsConfig | Promise<AnalyticsConfig>
    inject?: any[]
  }): Provider {
    const provider: FactoryProvider<AnalyticsService> = {
      provide: ANALYTICS_SERVICE,
      useFactory: async (...args: any[]) => {
        const config = await options.useFactory(...args)
        return new PosthogService(config)
      },
      inject: options.inject || [],
    }
    return provider
  }

  /**
   * Creates a provider for EcoAnalyticsService with proper dependency injection
   *
   * @returns Provider that creates EcoAnalyticsService instance with ANALYTICS_SERVICE injected
   */
  private static createEcoAnalyticsProvider(): Provider {
    return {
      provide: EcoAnalyticsService,
      useFactory: (analyticsService: AnalyticsService) => {
        return new EcoAnalyticsService(analyticsService)
      },
      inject: [ANALYTICS_SERVICE],
    }
  }
}
