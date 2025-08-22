import { OnModuleDestroy } from '@nestjs/common';
import { AnalyticsService, AnalyticsConfig } from '@eco-solver/analytics/analytics.interface';
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
export declare class PosthogService implements AnalyticsService, OnModuleDestroy {
    /** Logger instance for debugging and error reporting */
    private readonly logger;
    /** PostHog client instance for making API calls */
    private readonly client;
    /** Stored configuration for reference and debugging */
    private readonly config;
    /** Default groups applied to all analytics operations */
    private readonly defaultGroups;
    /**
     * Initialize PostHog service with configuration
     *
     * Sets up the PostHog client with optimized defaults for backend services
     * and validates required configuration.
     *
     * @param config - Analytics configuration object
     * @throws Error if API key is missing
     */
    constructor(config: AnalyticsConfig);
    /**
     * Initialize group identification for environment segmentation
     *
     * Sets up default groups (like environment) that will be automatically
     * applied to all analytics operations for proper segmentation.
     */
    private initializeGroups;
    /**
     * NestJS lifecycle hook - cleanup when module is destroyed
     *
     * Ensures graceful shutdown when the application terminates,
     * flushing any pending events before closing connections.
     */
    onModuleDestroy(): Promise<void>;
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
    capture(distinctId: string, event: string, properties?: Record<string, any>): Promise<void>;
    /**
     * Simplified event tracking with automatic distinct ID resolution
     *
     * Convenience method that extracts or assigns a distinct ID from properties.
     * Falls back to 'backend-service' for service-level events.
     *
     * @param event - Event name
     * @param properties - Event metadata (may include userId or distinctId)
     */
    trackEvent(event: string, properties?: Record<string, any>): Promise<void>;
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
    isFeatureEnabled(flag: string, distinctId: string, groups?: Record<string, string>): Promise<boolean>;
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
    getFeatureFlag(flag: string, distinctId: string, groups?: Record<string, string>): Promise<string | boolean | undefined>;
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
    getAllFlags(distinctId: string, groups?: Record<string, string>): Promise<Record<string, string | boolean>>;
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
    groupIdentify(groupType: string, groupKey: string, properties?: Record<string, any>): Promise<void>;
    /**
     * Force flush of pending events
     *
     * Sends all buffered events immediately instead of waiting for the
     * automatic flush interval. Important for ensuring data delivery
     * before application shutdown or after critical operations.
     *
     * @throws Error if flush operation fails
     */
    flush(): Promise<void>;
    /**
     * Gracefully shutdown the analytics service
     *
     * Performs cleanup operations including flushing pending events,
     * closing connections, and releasing resources. Should be called
     * during application shutdown to ensure data integrity.
     *
     * @throws Error if shutdown fails
     */
    shutdown(): Promise<void>;
}
