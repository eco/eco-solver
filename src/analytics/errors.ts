/**
 * Static error class for analytics module
 *
 * Centralizes all error creation and logging for the analytics module,
 * providing consistent error messages and structured error handling.
 */
export class AnalyticsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, any>,
  ) {
    super(message)
    this.name = 'AnalyticsError'
  }

  /**
   * Configuration validation errors
   */
  static missingApiKey(): AnalyticsError {
    return new AnalyticsError('PostHog API key is required', 'MISSING_API_KEY')
  }

  /**
   * Event capture errors
   */
  static eventCaptureFailed(
    event: string,
    distinctId: string,
    originalError: unknown,
  ): AnalyticsError {
    return new AnalyticsError(
      `Failed to capture event ${event} for user ${distinctId}`,
      'EVENT_CAPTURE_FAILED',
      { event, distinctId, originalError },
    )
  }

  /**
   * Feature flag errors
   */
  static featureFlagCheckFailed(
    flag: string,
    distinctId: string,
    originalError: unknown,
  ): AnalyticsError {
    return new AnalyticsError(
      `Failed to check feature flag ${flag} for user ${distinctId}`,
      'FEATURE_FLAG_CHECK_FAILED',
      { flag, distinctId, originalError },
    )
  }

  static featureFlagGetFailed(
    flag: string,
    distinctId: string,
    originalError: unknown,
  ): AnalyticsError {
    return new AnalyticsError(
      `Failed to get feature flag ${flag} for user ${distinctId}`,
      'FEATURE_FLAG_GET_FAILED',
      { flag, distinctId, originalError },
    )
  }

  static allFlagsGetFailed(distinctId: string, originalError: unknown): AnalyticsError {
    return new AnalyticsError(
      `Failed to get all flags for user ${distinctId}`,
      'ALL_FLAGS_GET_FAILED',
      { distinctId, originalError },
    )
  }

  /**
   * Group identification errors
   */
  static groupIdentifyFailed(
    groupType: string,
    groupKey: string,
    originalError: unknown,
  ): AnalyticsError {
    return new AnalyticsError(
      `Failed to identify group ${groupType}:${groupKey}`,
      'GROUP_IDENTIFY_FAILED',
      { groupType, groupKey, originalError },
    )
  }

  /**
   * Flush and shutdown errors
   */
  static flushFailed(originalError: unknown): AnalyticsError {
    return new AnalyticsError('Failed to flush PostHog events', 'FLUSH_FAILED', { originalError })
  }

  static shutdownFailed(originalError: unknown): AnalyticsError {
    return new AnalyticsError('Failed to shutdown PostHog service', 'SHUTDOWN_FAILED', {
      originalError,
    })
  }

  /**
   * General PostHog client errors
   */
  static posthogError(originalError: unknown): AnalyticsError {
    return new AnalyticsError('PostHog error occurred', 'POSTHOG_ERROR', { originalError })
  }
}

/**
 * Static success message class for analytics module
 *
 * Centralizes all success logging messages for consistency.
 */
export class AnalyticsMessages {
  /**
   * Initialization messages
   */
  static serviceInitialized(): string {
    return 'PostHog service initialized successfully'
  }

  static groupIdentified(groupType: string, groupKey: string): string {
    return `Identified group ${groupType}:${groupKey}`
  }

  /**
   * Operation success messages
   */
  static eventsFlushSuccessful(): string {
    return 'Successfully flushed pending analytics events'
  }

  static serviceShutdownSuccessful(): string {
    return 'PostHog service shut down successfully'
  }
}

/**
 * Static logger interface for analytics module
 *
 * Provides centralized logging with consistent error structure.
 */
export class AnalyticsLogger {
  /**
   * Log analytics errors with structured context
   */
  static logError(logger: any, error: AnalyticsError): void {
    logger.error(error.message, {
      code: error.code,
      context: error.context,
      stack: error.stack,
    })
  }

  /**
   * Log warnings for non-critical analytics failures
   */
  static logWarning(logger: any, error: AnalyticsError): void {
    logger.warn(error.message, {
      code: error.code,
      context: error.context,
    })
  }

  /**
   * Log successful operations
   */
  static logSuccess(logger: any, message: string, context?: Record<string, any>): void {
    logger.log(message, context)
  }

  /**
   * Log debug information
   */
  static logDebug(logger: any, message: string, context?: Record<string, any>): void {
    logger.debug(message, context)
  }
}
