import { BaseStructuredLogger } from './base-structured-logger'
import { DatadogLogStructure, EcoBusinessContext, LogLevel } from '../types'
import { TraceCorrelation } from '../apm/trace-correlation'

/**
 * Enhanced JSON logger with improved structure, performance optimizations,
 * and comprehensive context management for better observability
 */
export class EnhancedJsonLogger extends BaseStructuredLogger {
  private readonly defaultTags: string[]
  private readonly enrichmentEnabled: boolean
  private readonly contextCache: Map<string, any> = new Map()
  private readonly performanceTrackingEnabled: boolean

  constructor(
    context: string,
    options?: {
      timestamp?: boolean
      enableDatadogOptimization?: boolean
      defaultTags?: string[]
      enableEnrichment?: boolean
      enablePerformanceTracking?: boolean
    },
  ) {
    super(context, {
      timestamp: options?.timestamp ?? true,
      enableDatadogOptimization: options?.enableDatadogOptimization ?? true,
    })

    this.defaultTags = options?.defaultTags || []
    this.enrichmentEnabled = options?.enableEnrichment ?? true
    this.performanceTrackingEnabled = options?.enablePerformanceTracking ?? true
  }

  /**
   * Log with enhanced JSON structure and automatic enrichment
   */
  public logEnhanced(
    message: string,
    level: LogLevel = 'info',
    context?: Partial<EcoBusinessContext>,
    metadata?: {
      operation?: {
        type: string
        status?: string
        duration_ms?: number
        retry_count?: number
      }
      metrics?: Record<string, number | string>
      error?: Error
      tags?: string[]
    },
  ): void {
    const startTime = this.performanceTrackingEnabled ? performance.now() : 0

    // Build enhanced log structure
    const structure: DatadogLogStructure = this.buildEnhancedStructure(
      message,
      level,
      context,
      metadata,
    )

    // Track performance if enabled
    if (this.performanceTrackingEnabled) {
      const endTime = performance.now()
      if (structure.performance) {
        structure.performance.logging_overhead_ms = endTime - startTime
      } else {
        structure.performance = {
          response_time_ms: 0,
          logging_overhead_ms: endTime - startTime,
        }
      }
    }

    this.logStructured(structure, level)
  }

  /**
   * Log business events with rich context and automatic categorization
   */
  public logBusinessEvent(
    eventType: string,
    message: string,
    context: Partial<EcoBusinessContext>,
    metadata?: {
      status?: 'started' | 'completed' | 'failed' | 'pending'
      duration_ms?: number
      metrics?: Record<string, number | string>
      error?: Error
      severity?: 'low' | 'medium' | 'high' | 'critical'
    },
  ): void {
    const level: LogLevel = this.determineLevelFromMetadata(metadata)

    this.logEnhanced(
      message,
      level,
      {
        ...context,
        event_type: eventType,
      },
      {
        operation: {
          type: eventType,
          status: metadata?.status,
          duration_ms: metadata?.duration_ms,
        },
        metrics: metadata?.metrics,
        error: metadata?.error,
        tags: metadata?.severity ? [`severity:${metadata.severity}`] : undefined,
      },
    )
  }

  /**
   * Log performance metrics with automatic trend analysis
   */
  public logPerformanceMetrics(
    operation: string,
    metrics: {
      response_time_ms: number
      throughput?: number
      error_rate?: number
      cpu_usage?: number
      memory_usage?: number
      queue_depth?: number
      success_count?: number
      error_count?: number
    },
    context?: Partial<EcoBusinessContext>,
  ): void {
    // Determine performance level based on thresholds
    const level = this.determinePerformanceLevel(metrics)

    this.logEnhanced(
      `Performance metrics for ${operation}: ${metrics.response_time_ms}ms response time`,
      level,
      context,
      {
        operation: {
          type: 'performance_measurement',
          status: 'completed',
          duration_ms: metrics.response_time_ms,
        },
        metrics,
        tags: [
          `operation:${operation}`,
          `performance_tier:${this.categorizePerformance(metrics.response_time_ms)}`,
        ],
      },
    )
  }

  /**
   * Log errors with comprehensive context and automatic categorization
   */
  public logError(
    error: Error,
    operation: string,
    context?: Partial<EcoBusinessContext>,
    metadata?: {
      recoverable?: boolean
      retry_count?: number
      upstream_service?: string
      user_impact?: 'none' | 'degraded' | 'blocked'
      correlation_id?: string
    },
  ): void {
    this.logEnhanced(`Error in ${operation}: ${error.message}`, 'error', context, {
      operation: {
        type: operation,
        status: 'failed',
        retry_count: metadata?.retry_count,
      },
      error,
      tags: [
        `error_type:${error.name}`,
        `recoverable:${metadata?.recoverable ?? false}`,
        `user_impact:${metadata?.user_impact ?? 'unknown'}`,
      ],
    })
  }

  /**
   * Log with automatic context caching for performance optimization
   */
  public logWithCache(
    cacheKey: string,
    message: string,
    contextProvider: () => Partial<EcoBusinessContext>,
    level: LogLevel = 'info',
    cacheTtlMs: number = 30000, // 30 seconds default
  ): void {
    let context = this.contextCache.get(cacheKey)

    if (!context || this.isCacheExpired(context, cacheTtlMs)) {
      context = {
        ...contextProvider(),
        _cache_timestamp: Date.now(),
      }
      this.contextCache.set(cacheKey, context)
    }

    // Remove cache metadata before logging
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _cache_timestamp: _, ...loggingContext } = context
    this.logEnhanced(message, level, loggingContext)
  }

  /**
   * Batch logging for high-throughput scenarios with automatic flushing
   */
  public createBatchLogger(flushIntervalMs: number = 1000, maxBatchSize: number = 100) {
    const batch: Array<{
      message: string
      level: LogLevel
      context?: Partial<EcoBusinessContext>
      metadata?: any
    }> = []

    let flushTimeout: NodeJS.Timeout

    const flush = () => {
      if (batch.length === 0) return

      // Log batch summary
      this.logEnhanced(
        `Processing batch of ${batch.length} log entries`,
        'info',
        { event_type: 'batch_processing' },
        {
          operation: { type: 'batch_flush', status: 'started' },
          metrics: { batch_size: batch.length },
        },
      )

      // Process each entry
      const startTime = Date.now()
      batch.forEach((entry) => {
        this.logEnhanced(entry.message, entry.level, entry.context, entry.metadata)
      })
      const endTime = Date.now()

      // Log batch completion
      this.logEnhanced(
        `Completed batch processing in ${endTime - startTime}ms`,
        'info',
        { event_type: 'batch_processing_completed' },
        {
          operation: {
            type: 'batch_flush',
            status: 'completed',
            duration_ms: endTime - startTime,
          },
          metrics: { batch_size: batch.length, processing_time_ms: endTime - startTime },
        },
      )

      batch.length = 0 // Clear batch
    }

    const scheduleFlush = () => {
      if (flushTimeout) clearTimeout(flushTimeout)
      flushTimeout = setTimeout(flush, flushIntervalMs)
    }

    return {
      add: (
        message: string,
        level: LogLevel = 'info',
        context?: Partial<EcoBusinessContext>,
        metadata?: any,
      ) => {
        batch.push({ message, level, context, metadata })

        if (batch.length >= maxBatchSize) {
          flush()
        } else {
          scheduleFlush()
        }
      },
      flush,
      size: () => batch.length,
    }
  }

  /**
   * Build enhanced log structure with comprehensive context
   */
  private buildEnhancedStructure(
    message: string,
    level: LogLevel,
    context?: Partial<EcoBusinessContext>,
    metadata?: {
      operation?: any
      metrics?: Record<string, number | string>
      error?: Error
      tags?: string[]
    },
  ): DatadogLogStructure {
    const timestamp = new Date().toISOString()
    const enrichedContext = this.enrichmentEnabled ? this.enrichContext(context) : context

    // Build base structure
    const structure: DatadogLogStructure = {
      '@timestamp': timestamp,
      message,
      service: 'eco-solver',
      status: level,
      ddsource: 'nodejs',
      ddtags: this.buildTags(level, metadata?.tags),
      'logger.name': this.context,
    }

    // Add eco business context
    if (enrichedContext) {
      structure.eco = enrichedContext
    }

    // Add operation context
    if (metadata?.operation) {
      structure.operation = {
        ...metadata.operation,
        correlation_id: this.generateCorrelationId(),
      }
    }

    // Add metrics context
    if (metadata?.metrics) {
      structure.metrics = metadata.metrics
    }

    // Add error context
    if (metadata?.error) {
      structure.error = this.buildErrorContext(metadata.error, metadata.operation?.type)
    }

    // Add APM correlation if available
    if (this.enrichmentEnabled && TraceCorrelation.isTracingEnabled()) {
      const apmContext = TraceCorrelation.createCorrelationContext()
      if (apmContext.trace_id) {
        structure['dd.trace_id'] = apmContext.trace_id
      }
      if (apmContext.span_id) {
        structure['dd.span_id'] = apmContext.span_id
      }
    }

    return structure
  }

  /**
   * Enrich context with automatic data gathering
   */
  private enrichContext(context?: Partial<EcoBusinessContext>): EcoBusinessContext | undefined {
    if (!context) return undefined

    const enriched = { ...context }

    // Add automatic timestamp if not present
    if (!enriched.trace_id && TraceCorrelation.isTracingEnabled()) {
      const apmContext = TraceCorrelation.createCorrelationContext()
      enriched.trace_id = apmContext.trace_id
      enriched.span_id = apmContext.span_id
      enriched.service_name = apmContext.service_name
    }

    // Add environment context
    enriched.service_name = enriched.service_name || process.env.DD_SERVICE || 'eco-solver'

    return enriched
  }

  /**
   * Build comprehensive tags for Datadog faceting
   */
  private buildTags(level: LogLevel, additionalTags?: string[]): string {
    const tags = [
      `env:${TraceCorrelation.getEnvironmentName()}`,
      `service:eco-solver`,
      `level:${level}`,
      ...this.defaultTags,
    ]

    if (additionalTags) {
      tags.push(...additionalTags)
    }

    return tags.join(',')
  }

  /**
   * Build error context with comprehensive information
   */
  private buildErrorContext(error: Error, operation?: string): any {
    return {
      kind: error.name,
      message: error.message,
      stack: error.stack?.substring(0, 1000), // Limit stack trace size
      code: (error as any).code,
      status: (error as any).status || (error as any).statusCode,
      fingerprint: this.generateErrorFingerprint(error, operation),
    }
  }

  /**
   * Generate error fingerprint for deduplication
   */
  private generateErrorFingerprint(error: Error, operation?: string): string {
    const components = [
      error.name,
      error.message.substring(0, 50),
      operation || 'unknown_operation',
      error.stack?.split('\n')[1]?.trim().substring(0, 50) || '',
    ]
    return components.join('|').replace(/[^a-zA-Z0-9|]/g, '')
  }

  /**
   * Generate correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    const contextName = this.context || 'unknown'
    return `${contextName.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`
  }

  /**
   * Determine log level from metadata
   */
  private determineLevelFromMetadata(metadata?: {
    status?: string
    error?: Error
    severity?: string
  }): LogLevel {
    if (metadata?.error || metadata?.status === 'failed') return 'error'
    if (metadata?.severity === 'critical') return 'error'
    if (metadata?.severity === 'high') return 'warn'
    if (metadata?.status === 'pending') return 'info'
    return 'info'
  }

  /**
   * Determine performance level based on metrics
   */
  private determinePerformanceLevel(metrics: {
    response_time_ms: number
    error_rate?: number
  }): LogLevel {
    if (metrics.error_rate && metrics.error_rate > 0.1) return 'error' // >10% error rate
    if (metrics.response_time_ms > 5000) return 'warn' // >5s response time
    if (metrics.response_time_ms > 2000) return 'warn' // >2s response time (changed from 'info')
    if (metrics.response_time_ms > 500) return 'info' // >500ms response time
    return 'debug' // Good performance
  }

  /**
   * Categorize performance for tagging
   */
  private categorizePerformance(responseTimeMs: number): string {
    if (responseTimeMs < 100) return 'excellent'
    if (responseTimeMs < 500) return 'good'
    if (responseTimeMs < 2000) return 'acceptable'
    if (responseTimeMs < 5000) return 'slow'
    return 'critical'
  }

  /**
   * Check if cache entry is expired
   */
  private isCacheExpired(cacheEntry: any, ttlMs: number): boolean {
    const now = Date.now()
    const timestamp = cacheEntry._cache_timestamp || 0
    return now - timestamp > ttlMs
  }

  /**
   * Clear context cache
   */
  public clearCache(): void {
    this.contextCache.clear()
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.contextCache.size,
      keys: Array.from(this.contextCache.keys()),
    }
  }
}
