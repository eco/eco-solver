/**
 * Static error class for analytics module
 *
 * Centralizes all error creation and logging for the analytics module,
 * providing consistent error messages and structured error handling.
 */
export declare class AnalyticsError extends Error {
    readonly code: string;
    readonly context?: Record<string, any>;
    constructor(message: string, code: string, context?: Record<string, any>);
    /**
     * Configuration validation errors
     */
    static missingApiKey(): AnalyticsError;
    /**
     * Event capture errors
     */
    static eventCaptureFailed(event: string, distinctId: string, originalError: unknown): AnalyticsError;
    /**
     * Feature flag errors
     */
    static featureFlagCheckFailed(flag: string, distinctId: string, originalError: unknown): AnalyticsError;
    static featureFlagGetFailed(flag: string, distinctId: string, originalError: unknown): AnalyticsError;
    static allFlagsGetFailed(distinctId: string, originalError: unknown): AnalyticsError;
    /**
     * Group identification errors
     */
    static groupIdentifyFailed(groupType: string, groupKey: string, originalError: unknown): AnalyticsError;
    /**
     * Flush and shutdown errors
     */
    static flushFailed(originalError: unknown): AnalyticsError;
    static shutdownFailed(originalError: unknown): AnalyticsError;
    /**
     * General PostHog client errors
     */
    static posthogError(originalError: unknown): AnalyticsError;
}
/**
 * Static success message class for analytics module
 *
 * Centralizes all success logging messages for consistency.
 */
export declare class AnalyticsMessages {
    /**
     * Initialization messages
     */
    static serviceInitialized(): string;
    static groupIdentified(groupType: string, groupKey: string): string;
    /**
     * Operation success messages
     */
    static eventsFlushSuccessful(): string;
    static serviceShutdownSuccessful(): string;
}
/**
 * Static logger interface for analytics module
 *
 * Provides centralized logging with consistent error structure.
 */
export declare class AnalyticsLogger {
    /**
     * Log analytics errors with structured context
     */
    static logError(logger: any, error: AnalyticsError): void;
    /**
     * Log warnings for non-critical analytics failures
     */
    static logWarning(logger: any, error: AnalyticsError): void;
    /**
     * Log successful operations
     */
    static logSuccess(logger: any, message: string, context?: Record<string, any>): void;
    /**
     * Log debug information
     */
    static logDebug(logger: any, message: string, context?: Record<string, any>): void;
}
