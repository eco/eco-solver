/**
 * Core analytics service interface for backend event tracking and feature flags
 *
 * This interface defines the contract for analytics services in backend environments.
 * It focuses on server-side analytics needs rather than user-facing tracking:
 * - Event tracking for business logic and system events
 * - Feature flags for backend configuration and A/B testing
 * - Group analytics for team/service-level insights
 * - Batch operations for performance optimization
 *
 * Unlike frontend analytics, this interface excludes user identification
 * and person property management since backend services typically don't
 * need to track individual user profiles.
 */
export interface AnalyticsService {
  /**
   * Primary event tracking method for backend analytics
   *
   * @param distinctId - Unique identifier for the event source (user, service, etc.)
   * @param event - Event name following analytics naming conventions
   * @param properties - Optional event metadata and context
   *
   * @example
   * await analytics.capture('user_123', 'payment_processed', {
   *   amount: 100,
   *   currency: 'USD',
   *   paymentMethod: 'credit_card'
   * })
   */
  capture(distinctId: string, event: string, properties?: Record<string, any>): Promise<void>

  /**
   * Simplified event tracking with automatic distinct ID resolution
   *
   * @param event - Event name following analytics naming conventions
   * @param properties - Event metadata; can include userId or distinctId
   *
   * @example
   * await analytics.trackEvent('intent_created', {
   *   userId: 'user_123',
   *   intentId: 'intent_456',
   *   sourceChain: 'ethereum'
   * })
   */
  trackEvent(event: string, properties?: Record<string, any>): Promise<void>

  /**
   * Check if a feature flag is enabled for a specific entity
   *
   * @param flag - Feature flag identifier
   * @param distinctId - Entity identifier (user, service, etc.)
   * @param groups - Optional group context for flag evaluation
   * @returns Promise resolving to boolean flag state
   *
   * @example
   * const useNewAlgorithm = await analytics.isFeatureEnabled(
   *   'new_pricing_algorithm',
   *   'service_solver',
   *   { service: 'intent-processor' }
   * )
   */
  isFeatureEnabled(
    flag: string,
    distinctId: string,
    groups?: Record<string, string>,
  ): Promise<boolean>

  /**
   * Get the value of a feature flag (supports multivariate flags)
   *
   * @param flag - Feature flag identifier
   * @param distinctId - Entity identifier
   * @param groups - Optional group context for flag evaluation
   * @returns Promise resolving to flag value (string, boolean, or undefined)
   *
   * @example
   * const algorithmVersion = await analytics.getFeatureFlag(
   *   'algorithm_version',
   *   'service_solver'
   * )
   * // Returns: 'v2', true, false, or undefined
   */
  getFeatureFlag(
    flag: string,
    distinctId: string,
    groups?: Record<string, string>,
  ): Promise<string | boolean | undefined>

  /**
   * Retrieve all feature flags for an entity
   *
   * @param distinctId - Entity identifier
   * @param groups - Optional group context for flag evaluation
   * @returns Promise resolving to object with all flag values
   *
   * @example
   * const flags = await analytics.getAllFlags('service_solver')
   * // Returns: { new_algorithm: true, rate_limit: 100, feature_x: false }
   */
  getAllFlags(
    distinctId: string,
    groups?: Record<string, string>,
  ): Promise<Record<string, string | boolean>>

  /**
   * Associate properties with a group (team, service, organization)
   *
   * @param groupType - Type of group (e.g., 'team', 'service', 'organization')
   * @param groupKey - Unique identifier for the group
   * @param properties - Group metadata and attributes
   *
   * @example
   * await analytics.groupIdentify('service', 'intent-processor', {
   *   version: '1.2.3',
   *   region: 'us-west-2',
   *   instanceCount: 3
   * })
   */
  groupIdentify(
    groupType: string,
    groupKey: string,
    properties?: Record<string, any>,
  ): Promise<void>

  /**
   * Flush any pending events to the analytics service
   *
   * Important for ensuring events are sent before application shutdown
   * or after processing large batches of data.
   *
   * @example
   * // Before application shutdown
   * await analytics.flush()
   *
   * // After processing large dataset
   * for (const item of largeDataset) {
   *   await analytics.trackEvent('item_processed', { itemId: item.id })
   * }
   * await analytics.flush()
   */
  flush(): Promise<void>

  /**
   * Gracefully shutdown the analytics service
   *
   * Should be called during application shutdown to ensure all events
   * are sent and resources are properly cleaned up.
   *
   * @example
   * // In application shutdown handler
   * await analytics.shutdown()
   */
  shutdown(): Promise<void>
}

/**
 * Configuration interface for analytics services
 *
 * Provides options for connecting to and configuring analytics providers
 * like PostHog. All properties are optional to allow for flexible
 * configuration and sensible defaults.
 */
export interface AnalyticsConfig {
  /**
   * Analytics service API key (required for most providers)
   *
   * @example 'ph_1234567890abcdef' for PostHog
   */
  apiKey?: string

  /**
   * Analytics service endpoint URL
   *
   * @default 'https://us.posthog.com' for PostHog US
   * @example 'https://eu.posthog.com' for PostHog EU
   */
  host?: string

  /**
   * Number of events to batch before sending to analytics service
   *
   * Higher values reduce network requests but increase memory usage
   * and delay before events are sent.
   *
   * @default 20
   */
  flushAt?: number

  /**
   * Maximum time in milliseconds to wait before flushing events
   *
   * Ensures events are sent even if the batch size isn't reached.
   *
   * @default 10000 (10 seconds)
   */
  flushInterval?: number

  /**
   * HTTP request timeout in milliseconds
   *
   * @default 10000 (10 seconds)
   */
  requestTimeout?: number

  /**
   * Maximum number of events to cache before dropping old events
   *
   * Prevents memory issues during high-volume periods or network outages.
   *
   * @default 10000
   */
  maxCacheSize?: number

  /**
   * Disable automatic IP geolocation
   *
   * Set to true to disable location tracking for privacy compliance.
   *
   * @default false
   */
  disableGeoip?: boolean

  /**
   * Personal API key for feature flags (PostHog specific)
   *
   * Required for feature flag functionality in some analytics providers.
   */
  personalApiKey?: string

  /**
   * Feature flags polling interval in milliseconds
   *
   * How often to check for feature flag updates from the server.
   *
   * @default 30000 (30 seconds)
   */
  featureFlagsPollingInterval?: number

  /**
   * Custom error handler for analytics errors
   *
   * Called when analytics operations fail. Default behavior logs errors.
   *
   * @param error - The error that occurred
   *
   * @example
   * onError: (error) => {
   *   console.error('Analytics error:', error)
   *   // Send to error monitoring service
   * }
   */
  onError?: (error: Error) => void

  /**
   * Default group context for analytics events
   *
   * Groups are automatically applied to all analytics operations.
   * Commonly used for environment segmentation (dev, staging, production).
   *
   * @example
   * groups: {
   *   environment: 'production',
   *   service: 'eco-solver',
   *   region: 'us-west-2'
   * }
   */
  groups?: Record<string, string>
}
