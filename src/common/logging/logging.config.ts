/**
 * Configuration for the logging system including Datadog optimizations
 */
export interface LoggingConfig {
  /** Enable Datadog validation and optimization features */
  enableDatadogOptimization: boolean

  /** Performance thresholds for monitoring */
  performanceThresholds: {
    /** Maximum acceptable validation time in milliseconds */
    maxValidationTimeMs: number

    /** Maximum acceptable log size in bytes before warnings */
    maxLogSizeBytes: number

    /** Maximum acceptable truncation rate (0-1) */
    maxTruncationRate: number
  }

  /** Development/debugging options */
  development: {
    /** Log validation warnings to console in development mode */
    logValidationWarnings: boolean

    /** Include performance metrics in logs */
    includePerformanceMetrics: boolean
  }
}

/**
 * Default logging configuration optimized for production
 */
export const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  enableDatadogOptimization: true,
  performanceThresholds: {
    maxValidationTimeMs: 5,
    maxLogSizeBytes: 15 * 1024, // 15KB
    maxTruncationRate: 0.05, // 5%
  },
  development: {
    logValidationWarnings: process.env.NODE_ENV === 'development',
    includePerformanceMetrics: false,
  },
}

/**
 * High-performance configuration for high-volume services
 */
export const HIGH_PERFORMANCE_LOGGING_CONFIG: LoggingConfig = {
  enableDatadogOptimization: false, // Disable for maximum performance
  performanceThresholds: {
    maxValidationTimeMs: 1,
    maxLogSizeBytes: 5 * 1024, // 5KB
    maxTruncationRate: 0.1, // 10%
  },
  development: {
    logValidationWarnings: false,
    includePerformanceMetrics: false,
  },
}

/**
 * Development configuration with enhanced debugging
 */
export const DEVELOPMENT_LOGGING_CONFIG: LoggingConfig = {
  enableDatadogOptimization: true,
  performanceThresholds: {
    maxValidationTimeMs: 50, // More lenient for development
    maxLogSizeBytes: 50 * 1024, // 50KB
    maxTruncationRate: 0.2, // 20%
  },
  development: {
    logValidationWarnings: true,
    includePerformanceMetrics: true,
  },
}
