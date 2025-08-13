import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { PostHog } from 'posthog-node'
import { AnalyticsService, AnalyticsConfig } from './analytics.interface'
import { AnalyticsError, AnalyticsLogger, AnalyticsMessages } from './errors'
import { convertBigIntsToStrings } from '@libs/shared'

/**
 * PostHog analytics service implementation for backend event tracking
 *
 * This service provides a production-ready implementation of the AnalyticsService
 * interface using PostHog as the analytics backend. It's optimized for server-side
 * usage with the following features:
 *
 * - Event batching for improved performance
 * - Automatic error handling and logging
 * - Feature flag support for backend configuration
 * - Group analytics for service/team tracking
 * - Graceful shutdown handling
 * - Configurable defaults optimized for backend services
 *
 * The service implements NestJS lifecycle hooks to ensure proper cleanup
 * when the application shuts down.
 *
 * @example
 * // Basic usage through dependency injection
 * constructor(
 *   @Inject(ANALYTICS_SERVICE) private analytics: AnalyticsService
 * ) {}
 *
 * await this.analytics.trackEvent('user_action', { userId: '123' })
 */
@Injectable()
export class PosthogService implements AnalyticsService, OnModuleDestroy {
  /** Logger instance for debugging and error reporting */
  private readonly logger = new Logger(PosthogService.name)

  /** PostHog client instance for making API calls */
  private readonly client: PostHog

  /** Stored configuration for reference and debugging */
  private readonly config: AnalyticsConfig

  /** Default groups applied to all analytics operations */
  private readonly defaultGroups: Record<string, string>

  /**
   * Initialize PostHog service with configuration
   *
   * Sets up the PostHog client with optimized defaults for backend services
   * and validates required configuration.
   *
   * @param config - Analytics configuration object
   * @throws Error if API key is missing
   */
  constructor(config: AnalyticsConfig) {
    this.config = config
    this.defaultGroups = config.groups || {}

    // Validate required configuration
    if (!config.apiKey) {
      throw AnalyticsError.missingApiKey()
    }

    // Default PostHog configuration optimized for backend services
    const defaultConfig = {
      host: 'https://us.i.posthog.com', // PostHog US endpoint
      flushAt: 20, // Batch size before sending events (balance between performance and latency)
      flushInterval: 10000, // Flush interval in milliseconds (10 seconds - ensures timely delivery)
      requestTimeout: 10000, // Request timeout in milliseconds (10 seconds - reasonable for server-to-server)
      maxCacheSize: 10000, // Maximum number of events to cache (prevents memory issues)
      person_profiles: false, // Disable person profiles for backend analytics (not useful in server context)
      disableGeoip: false, // Disable GeoIP for location tracking (not useful for backend analytics)
      featureFlagsPollingInterval: 30000, // Feature flags polling interval (30 seconds - good balance for backend)
      onError: (error: Error) => {
        AnalyticsLogger.logError(this.logger, AnalyticsError.posthogError(error))
      },
    }

    // Merge user-provided config with defaults, prioritizing user settings
    const mergedConfig = {
      ...defaultConfig,
      ...config,
      // Ensure error handler is always defined
      onError: config.onError || defaultConfig.onError,
    }

    // Initialize PostHog client with merged configuration
    this.client = new PostHog(config.apiKey, mergedConfig)

    // Set up environment-based group identification if groups are configured
    this.initializeGroups()

    AnalyticsLogger.logSuccess(this.logger, AnalyticsMessages.serviceInitialized())
  }

  /**
   * Initialize group identification for environment segmentation
   *
   * Sets up default groups (like environment) that will be automatically
   * applied to all analytics operations for proper segmentation.
   */
  private initializeGroups(): void {
    // Identify groups for environment segmentation (dev, staging, production, etc.)
    for (const [groupType, groupKey] of Object.entries(this.defaultGroups)) {
      try {
        this.client.groupIdentify({
          groupType,
          groupKey,
          properties: {
            // Add metadata about when this group was identified
            identifiedAt: new Date().toISOString(),
            service: 'eco-solver',
          },
        })
        AnalyticsLogger.logDebug(
          this.logger,
          AnalyticsMessages.groupIdentified(groupType, groupKey),
        )
      } catch (error) {
        AnalyticsLogger.logWarning(
          this.logger,
          AnalyticsError.groupIdentifyFailed(groupType, groupKey, error),
        )
      }
    }
  }

  /**
   * NestJS lifecycle hook - cleanup when module is destroyed
   *
   * Ensures graceful shutdown when the application terminates,
   * flushing any pending events before closing connections.
   */
  async onModuleDestroy(): Promise<void> {
    await this.shutdown()
  }

  /**
   * Core event tracking implementation
   *
   * Captures events with metadata and automatic timestamp addition.
   * Handles errors gracefully while maintaining event delivery guarantees.
   *
   * @param distinctId - Unique identifier for the event source
   * @param event - Event name (should follow naming conventions)
   * @param properties - Event metadata and context
   * @throws Error if event capture fails
   */
  async capture(
    distinctId: string,
    event: string,
    properties?: Record<string, any>,
  ): Promise<void> {
    try {
      // Convert BigInt values to strings to prevent serialization errors
      const serializedProperties = properties ? convertBigIntsToStrings(properties) : {}

      // Send event to PostHog with enhanced metadata
      this.client.capture({
        distinctId,
        event,
        properties: {
          ...serializedProperties,
          // Add automatic timestamp for accurate event ordering
          timestamp: new Date(),
        },
      })
    } catch (error) {
      // Log specific error with context for debugging
      const analyticsError = AnalyticsError.eventCaptureFailed(event, distinctId, error)
      AnalyticsLogger.logError(this.logger, analyticsError)
      throw analyticsError
    }
  }

  /**
   * Simplified event tracking with automatic distinct ID resolution
   *
   * Convenience method that extracts or assigns a distinct ID from properties.
   * Falls back to 'backend-service' for service-level events.
   *
   * @param event - Event name
   * @param properties - Event metadata (may include userId or distinctId)
   */
  async trackEvent(event: string, properties?: Record<string, any>): Promise<void> {
    // Extract distinct ID from properties or use service-level default
    const distinctId = properties?.userId || properties?.distinctId || 'backend-service'
    await this.capture(distinctId, event, properties)
  }

  /**
   * Check if a feature flag is enabled
   *
   * Safely evaluates feature flags with error handling and logging.
   * Returns false on any error to ensure safe fallback behavior.
   *
   * @param flag - Feature flag key/name
   * @param distinctId - Entity identifier for flag evaluation
   * @param groups - Optional group context for targeted rollouts
   * @returns Promise resolving to boolean flag state (false on error)
   */
  async isFeatureEnabled(
    flag: string,
    distinctId: string,
    groups?: Record<string, string>,
  ): Promise<boolean> {
    try {
      // Merge default groups with provided groups, giving precedence to provided groups
      const mergedGroups = { ...this.defaultGroups, ...groups }
      const result = await this.client.isFeatureEnabled(flag, distinctId, mergedGroups)
      return Boolean(result)
    } catch (error) {
      // Log error but return safe default to prevent service disruption
      AnalyticsLogger.logError(
        this.logger,
        AnalyticsError.featureFlagCheckFailed(flag, distinctId, error),
      )
      return false
    }
  }

  /**
   * Get feature flag value (supports multivariate flags)
   *
   * Retrieves the actual value of a feature flag, which can be a string,
   * boolean, or undefined. Useful for multivariate tests and configuration.
   *
   * @param flag - Feature flag key/name
   * @param distinctId - Entity identifier for flag evaluation
   * @param groups - Optional group context for targeted rollouts
   * @returns Promise resolving to flag value or undefined on error
   */
  async getFeatureFlag(
    flag: string,
    distinctId: string,
    groups?: Record<string, string>,
  ): Promise<string | boolean | undefined> {
    try {
      // Merge default groups with provided groups, giving precedence to provided groups
      const mergedGroups = { ...this.defaultGroups, ...groups }
      return await this.client.getFeatureFlag(flag, distinctId, mergedGroups)
    } catch (error) {
      // Log error but return safe default
      AnalyticsLogger.logError(
        this.logger,
        AnalyticsError.featureFlagGetFailed(flag, distinctId, error),
      )
      return undefined
    }
  }

  /**
   * Retrieve all feature flags for an entity
   *
   * Bulk retrieval of all feature flags for performance optimization.
   * Returns empty object on error to ensure safe fallback behavior.
   *
   * @param distinctId - Entity identifier for flag evaluation
   * @param groups - Optional group context for targeted rollouts
   * @returns Promise resolving to object with all flag values
   */
  async getAllFlags(
    distinctId: string,
    groups?: Record<string, string>,
  ): Promise<Record<string, string | boolean>> {
    try {
      // Merge default groups with provided groups, giving precedence to provided groups
      const mergedGroups = { ...this.defaultGroups, ...groups }
      // Ensure we always return an object, even if client returns null/undefined
      return (await this.client.getAllFlags(distinctId, mergedGroups)) || {}
    } catch (error) {
      // Log error but return safe default
      AnalyticsLogger.logError(this.logger, AnalyticsError.allFlagsGetFailed(distinctId, error))
      return {}
    }
  }

  /**
   * Associate properties with a group entity
   *
   * Groups allow you to track analytics at the organization, team, or service level.
   * Useful for B2B analytics and service-level insights.
   *
   * @param groupType - Type of group (e.g., 'organization', 'team', 'service')
   * @param groupKey - Unique identifier for the group
   * @param properties - Group metadata and attributes
   * @throws Error if group identification fails
   */
  async groupIdentify(
    groupType: string,
    groupKey: string,
    properties?: Record<string, any>,
  ): Promise<void> {
    try {
      this.client.groupIdentify({
        groupType,
        groupKey,
        properties,
      })
    } catch (error) {
      // Log error with group context for debugging
      const analyticsError = AnalyticsError.groupIdentifyFailed(groupType, groupKey, error)
      AnalyticsLogger.logError(this.logger, analyticsError)
      throw analyticsError
    }
  }

  /**
   * Force flush of pending events
   *
   * Sends all buffered events immediately instead of waiting for the
   * automatic flush interval. Important for ensuring data delivery
   * before application shutdown or after critical operations.
   *
   * @throws Error if flush operation fails
   */
  async flush(): Promise<void> {
    try {
      await this.client.flush()
      AnalyticsLogger.logDebug(this.logger, AnalyticsMessages.eventsFlushSuccessful())
    } catch (error) {
      const analyticsError = AnalyticsError.flushFailed(error)
      AnalyticsLogger.logError(this.logger, analyticsError)
      throw analyticsError
    }
  }

  /**
   * Gracefully shutdown the analytics service
   *
   * Performs cleanup operations including flushing pending events,
   * closing connections, and releasing resources. Should be called
   * during application shutdown to ensure data integrity.
   *
   * @throws Error if shutdown fails
   */
  async shutdown(): Promise<void> {
    try {
      // Flush any remaining events and close connections
      await this.client.shutdown()
      AnalyticsLogger.logSuccess(this.logger, AnalyticsMessages.serviceShutdownSuccessful())
    } catch (error) {
      const analyticsError = AnalyticsError.shutdownFailed(error)
      AnalyticsLogger.logError(this.logger, analyticsError)
      throw analyticsError
    }
  }
}
