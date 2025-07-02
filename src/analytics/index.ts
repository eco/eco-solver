/**
 * Analytics Module Exports
 *
 * This module provides a comprehensive analytics solution for backend services
 * with PostHog integration. It includes:
 *
 * - AnalyticsModule: Dynamic NestJS module with flexible configuration options
 * - AnalyticsService: Interface defining the analytics contract
 * - PosthogService: Production-ready PostHog implementation
 * - AnalyticsConfig: Configuration interface for analytics providers
 * - ANALYTICS_SERVICE: Injection token for dependency injection
 *
 * @example Basic Usage
 * ```typescript
 * // In app.module.ts
 * import { AnalyticsModule } from '@/analytics'
 *
 * @Module({
 *   imports: [
 *     AnalyticsModule.withAsyncConfig({
 *       useFactory: (config: EcoConfigService) => config.getAnalyticsConfig(),
 *       inject: [EcoConfigService],
 *     })
 *   ]
 * })
 * export class AppModule {}
 * ```
 *
 * @example Service Usage
 * ```typescript
 * // In any service
 * import { Injectable, Inject } from '@nestjs/common'
 * import { AnalyticsService, ANALYTICS_SERVICE } from '@/analytics'
 *
 * @Injectable()
 * export class SomeService {
 *   constructor(
 *     @Inject(ANALYTICS_SERVICE) private analytics: AnalyticsService
 *   ) {}
 *
 *   async processPayment(amount: number, userId: string) {
 *     await this.analytics.trackEvent('payment_processed', {
 *       amount,
 *       userId,
 *       timestamp: new Date().toISOString()
 *     })
 *   }
 * }
 * ```
 */

// Core module and configuration exports
export { AnalyticsModule, ANALYTICS_SERVICE } from '@/analytics/analytics.module'

// Service implementation export
export { PosthogService } from '@/analytics/posthog.service'

// Interface and type exports
export { AnalyticsService, AnalyticsConfig } from '@/analytics/analytics.interface'

// Utility exports
export { getCurrentEnvironment } from '@/analytics/utils'

// Error handling exports
export { AnalyticsError, AnalyticsMessages, AnalyticsLogger } from '@/analytics/errors'
