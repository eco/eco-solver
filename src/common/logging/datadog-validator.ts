import { DATADOG_LIMITS } from './types'

/**
 * Utility functions for Datadog log compliance and optimization.
 * Ensures logs meet Datadog's size and attribute limits for optimal processing.
 */

export interface ValidationResult {
  isValid: boolean
  truncated: boolean
  warnings: string[]
  processedData: any
}

/**
 * Validates and optimizes log data for Datadog compliance
 */
export class DatadogValidator {
  /**
   * Validates and processes a log object for Datadog compliance
   * @param logData - The log data to validate
   * @returns Validation result with processed data
   */
  static validateAndOptimize(logData: any): ValidationResult {
    const warnings: string[] = []
    let truncated = false
    let processedData = this.deepClone(logData)

    // Step 1: Validate and truncate attribute keys
    processedData = this.validateAttributeKeys(processedData, warnings)

    // Step 2: Limit nesting depth
    processedData = this.limitNestingDepth(processedData, warnings)

    // Step 3: Validate attribute count
    const attributeCount = this.countAttributes(processedData)
    if (attributeCount > DATADOG_LIMITS.MAX_ATTRIBUTES) {
      warnings.push(
        `Attribute count ${attributeCount} exceeds limit ${DATADOG_LIMITS.MAX_ATTRIBUTES}`,
      )
      processedData = this.truncateAttributes(processedData)
      truncated = true
    }

    // Step 4: Validate and truncate attribute values
    processedData = this.validateAttributeValues(processedData, warnings)

    // Step 5: Check overall log size
    const logSize = this.safeStringify(processedData).length
    if (logSize > DATADOG_LIMITS.MAX_LOG_SIZE) {
      warnings.push(`Log size ${logSize} bytes exceeds limit ${DATADOG_LIMITS.MAX_LOG_SIZE} bytes`)
      processedData = this.truncateLogSize(processedData)
      truncated = true
    }

    return {
      isValid: warnings.length === 0,
      truncated,
      warnings,
      processedData,
    }
  }

  /**
   * Sanitizes high-cardinality identifiers for faceted search optimization
   */
  static sanitizeForFacets(value: string): string {
    // Remove or hash high-cardinality parts for better facet performance
    if (value.length > 32) {
      // For long values, keep prefix and add hash suffix
      const prefix = value.substring(0, 16)
      const hash = this.simpleHash(value).toString(16)
      return `${prefix}...${hash}`
    }
    return value
  }

  /**
   * Creates optimized faceted field names for high-cardinality identifiers
   */
  static createFacetedField(fieldName: string, value: string): Record<string, string> {
    return {
      [fieldName]: this.sanitizeForFacets(value),
      [`${fieldName}_full`]: value, // Store full value as non-faceted field
    }
  }

  private static validateAttributeKeys(obj: any, warnings: string[]): any {
    if (typeof obj !== 'object' || obj === null) return obj

    const result: any = Array.isArray(obj) ? [] : {}

    for (const [key, value] of Object.entries(obj)) {
      let processedKey = key

      // Truncate key if too long
      if (key.length > DATADOG_LIMITS.MAX_ATTRIBUTE_KEY_LENGTH) {
        processedKey = key.substring(0, DATADOG_LIMITS.MAX_ATTRIBUTE_KEY_LENGTH)
        warnings.push(`Attribute key '${key}' truncated to '${processedKey}'`)
      }

      // Recursively process nested objects
      result[processedKey] = this.validateAttributeKeys(value, warnings)
    }

    return result
  }

  private static limitNestingDepth(obj: any, warnings: string[], currentDepth = 0): any {
    if (currentDepth >= DATADOG_LIMITS.MAX_NESTED_LEVELS) {
      warnings.push(
        `Nesting depth limit ${DATADOG_LIMITS.MAX_NESTED_LEVELS} reached, truncating deeper levels`,
      )
      return '[TRUNCATED - MAX DEPTH REACHED]'
    }

    if (typeof obj !== 'object' || obj === null) return obj

    const result: any = Array.isArray(obj) ? [] : {}

    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.limitNestingDepth(value, warnings, currentDepth + 1)
    }

    return result
  }

  private static countAttributes(obj: any, count = 0): number {
    if (typeof obj !== 'object' || obj === null) return count

    for (const [, value] of Object.entries(obj)) {
      count++
      if (typeof value === 'object' && value !== null) {
        count = this.countAttributes(value, count)
      }
    }

    return count
  }

  private static truncateAttributes(obj: any): any {
    // Simple strategy: keep only first N attributes at root level
    const maxRootAttributes = Math.floor(DATADOG_LIMITS.MAX_ATTRIBUTES * 0.8) // Reserve 20% for nested
    const entries = Object.entries(obj)

    if (entries.length <= maxRootAttributes) return obj

    const result: any = {}
    entries.slice(0, maxRootAttributes).forEach(([key, value]) => {
      result[key] = value
    })

    result._truncated_attributes = entries.length - maxRootAttributes
    return result
  }

  private static validateAttributeValues(obj: any, warnings: string[]): any {
    if (typeof obj !== 'object' || obj === null) return obj

    const result: any = Array.isArray(obj) ? [] : {}

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.length > DATADOG_LIMITS.MAX_ATTRIBUTE_VALUE_LENGTH) {
        const truncated = value.substring(0, DATADOG_LIMITS.MAX_ATTRIBUTE_VALUE_LENGTH - 3) + '...'
        result[key] = truncated
        warnings.push(
          `Attribute value for '${key}' truncated from ${value.length} to ${truncated.length} characters`,
        )
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.validateAttributeValues(value, warnings)
      } else {
        result[key] = value
      }
    }

    return result
  }

  private static truncateLogSize(obj: any): any {
    // Progressive truncation strategy
    let processed = { ...obj }
    let currentSize = this.safeStringify(processed).length

    if (currentSize <= DATADOG_LIMITS.MAX_LOG_SIZE) return processed

    // 1. Truncate long string values progressively
    processed = this.progressiveStringTruncation(processed)
    currentSize = this.safeStringify(processed).length

    if (currentSize <= DATADOG_LIMITS.MAX_LOG_SIZE) return processed

    // 2. Remove optional properties
    const optionalFields = ['properties', 'error', 'trace_id']
    for (const field of optionalFields) {
      if (processed[field]) {
        delete processed[field]
        currentSize = this.safeStringify(processed).length
        if (currentSize <= DATADOG_LIMITS.MAX_LOG_SIZE) break
      }
    }

    // 3. Add truncation marker
    processed._size_truncated = true
    return processed
  }

  private static progressiveStringTruncation(obj: any, maxLength = 256): any {
    if (typeof obj !== 'object' || obj === null) return obj

    const result: any = Array.isArray(obj) ? [] : {}

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.length > maxLength) {
        result[key] = value.substring(0, maxLength - 3) + '...'
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.progressiveStringTruncation(value, maxLength)
      } else {
        result[key] = value
      }
    }

    return result
  }

  private static deepClone(obj: any): any {
    return JSON.parse(this.safeStringify(obj))
  }

  private static safeStringify(obj: any): string {
    return JSON.stringify(obj, (key, value) => {
      // Convert BigInt to string for serialization
      if (typeof value === 'bigint') {
        return value.toString()
      }
      return value
    })
  }

  private static simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }
}

/**
 * Performance metrics collector for logging overhead monitoring
 */
export class LoggingMetrics {
  private static metrics = {
    validationTime: [] as number[],
    logSizes: [] as number[],
    truncationCount: 0,
    warningCount: 0,
  }

  static recordValidation(
    timeMs: number,
    logSize: number,
    hadWarnings: boolean,
    wasTruncated: boolean,
  ) {
    this.metrics.validationTime.push(timeMs)
    this.metrics.logSizes.push(logSize)

    if (hadWarnings) this.metrics.warningCount++
    if (wasTruncated) this.metrics.truncationCount++

    // Keep only recent metrics (last 1000)
    if (this.metrics.validationTime.length > 1000) {
      this.metrics.validationTime.shift()
      this.metrics.logSizes.shift()
    }
  }

  static getMetrics() {
    const avgValidationTime =
      this.metrics.validationTime.length > 0
        ? this.metrics.validationTime.reduce((a, b) => a + b) / this.metrics.validationTime.length
        : 0

    const avgLogSize =
      this.metrics.logSizes.length > 0
        ? this.metrics.logSizes.reduce((a, b) => a + b) / this.metrics.logSizes.length
        : 0

    return {
      averageValidationTimeMs: avgValidationTime,
      averageLogSizeBytes: avgLogSize,
      totalTruncations: this.metrics.truncationCount,
      totalWarnings: this.metrics.warningCount,
      samplesProcessed: this.metrics.validationTime.length,
    }
  }
}
