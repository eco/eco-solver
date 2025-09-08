import { EcoLogger } from '../eco-logger'
import { LogLevel, DatadogLogStructure } from '../types'
import { DatadogValidator, LoggingMetrics } from '../datadog-validator'

/**
 * Base class for specialized loggers with enhanced Datadog structure support
 */
export abstract class BaseStructuredLogger extends EcoLogger {
  private datadogOptimizationEnabled: boolean = true

  constructor(
    context: string,
    options?: { timestamp?: boolean; enableDatadogOptimization?: boolean },
  ) {
    super(context, options)
    this.datadogOptimizationEnabled = options?.enableDatadogOptimization ?? true
  }

  /**
   * Log a structured message using Datadog format with validation and optimization
   */
  protected logStructured(structure: DatadogLogStructure, level: LogLevel = 'info'): void {
    let processedStructure = structure

    // Apply Datadog validation and optimization if enabled
    if (this.datadogOptimizationEnabled) {
      const startTime = Date.now()
      const validation = DatadogValidator.validateAndOptimize(structure)
      const endTime = Date.now()

      processedStructure = validation.processedData

      // Record metrics for monitoring
      LoggingMetrics.recordValidation(
        endTime - startTime,
        this.safeStringify(structure).length,
        validation.warnings.length > 0,
        validation.truncated,
      )

      // Log validation warnings in development/debug mode
      if (validation.warnings.length > 0) {
        const warningMessage = `Datadog validation warnings for ${this.context}: ${validation.warnings.join(', ')}`
        if (level === 'debug' || process.env.NODE_ENV === 'development') {
          super.debug(warningMessage)
        }
      }
    }

    // Apply optimizations for high-cardinality fields
    processedStructure = this.optimizeForDatadog(processedStructure)

    switch (level) {
      case 'debug':
        super.debug(processedStructure)
        break
      case 'info':
        super.log(processedStructure)
        break
      case 'warn':
        super.warn(processedStructure)
        break
      case 'error':
        super.error(processedStructure)
        break
    }
  }

  /**
   * Helper method for logging business events with structured context
   */
  protected logMessage(context: any, level: LogLevel, message: string): void {
    const structure = {
      message,
      timestamp: new Date().toISOString(),
      level,
      service: this.context,
      ...context,
    }
    this.logStructured(structure, level)
  }

  /**
   * Applies Datadog-specific optimizations for better facet performance
   */
  private optimizeForDatadog(structure: DatadogLogStructure): DatadogLogStructure {
    const optimized = { ...structure }

    // Optimize eco context high-cardinality fields for faceted search
    if (optimized.eco) {
      if (optimized.eco.intent_hash) {
        const faceted = DatadogValidator.createFacetedField(
          'intent_hash',
          optimized.eco.intent_hash,
        )
        optimized.eco.intent_hash = faceted.intent_hash
        optimized.eco.intent_hash_full = faceted.intent_hash_full
      }

      if (optimized.eco.rebalance_id) {
        const faceted = DatadogValidator.createFacetedField(
          'rebalance_id',
          optimized.eco.rebalance_id,
        )
        optimized.eco.rebalance_id = faceted.rebalance_id
        optimized.eco.rebalance_id_full = faceted.rebalance_id_full
      }

      if (optimized.eco.quote_id) {
        const faceted = DatadogValidator.createFacetedField('quote_id', optimized.eco.quote_id)
        optimized.eco.quote_id = faceted.quote_id
        optimized.eco.quote_id_full = faceted.quote_id_full
      }
    }

    return optimized
  }

  /**
   * Gets current logging performance metrics
   */
  static getLoggingMetrics() {
    return LoggingMetrics.getMetrics()
  }

  /**
   * Safely stringify objects that may contain BigInt values
   */
  private safeStringify(obj: any): string {
    return JSON.stringify(obj, (key, value) => {
      // Convert BigInt to string for serialization
      if (typeof value === 'bigint') {
        return value.toString()
      }
      return value
    })
  }
}
