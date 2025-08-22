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
 * import { AnalyticsModule } from '@eco-solver/analytics'
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
 * import { AnalyticsService, ANALYTICS_SERVICE } from '@eco-solver/analytics'
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
export { AnalyticsModule, ANALYTICS_SERVICE } from './analytics.module';
export { PosthogService } from './posthog.service';
export { AnalyticsService, AnalyticsConfig } from './analytics.interface';
export { getCurrentEnvironment } from './utils';
export { AnalyticsError, AnalyticsMessages, AnalyticsLogger } from './errors';
export { EcoAnalyticsService } from './eco-analytics.service';
export { ANALYTICS_EVENTS } from './events.constants';
