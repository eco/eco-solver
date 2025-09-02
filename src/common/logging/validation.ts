import { DATADOG_LIMITS } from './types'

/**
 * Validation utilities for Datadog log structures
 */
export class LogValidation {
  /**
   * Validate attribute key length
   */
  static validateAttributeKey(key: string): boolean {
    if (key.length > DATADOG_LIMITS.MAX_ATTRIBUTE_KEY_LENGTH) {
      // eslint-disable-next-line no-console
      console.warn(
        `Attribute key '${key}' exceeds ${DATADOG_LIMITS.MAX_ATTRIBUTE_KEY_LENGTH} characters`,
      )
      return false
    }
    return true
  }

  /**
   * Validate attribute value length for faceted fields
   */
  static validateAttributeValue(value: any): boolean {
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value)
    if (valueStr.length > DATADOG_LIMITS.MAX_ATTRIBUTE_VALUE_LENGTH) {
      // eslint-disable-next-line no-console
      console.warn(
        `Attribute value exceeds ${DATADOG_LIMITS.MAX_ATTRIBUTE_VALUE_LENGTH} characters`,
      )
      return false
    }
    return true
  }

  /**
   * Count total attributes in a log structure
   */
  static countAttributes(obj: any, depth = 0): number {
    if (depth > DATADOG_LIMITS.MAX_NESTED_LEVELS || typeof obj !== 'object' || obj === null) {
      return 1
    }

    let count = 0
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        count += 1 + this.countAttributes(obj[key], depth + 1)
      }
    }
    return count
  }

  /**
   * Calculate log size in bytes
   */
  static calculateLogSize(obj: any): number {
    return JSON.stringify(obj).length
  }

  /**
   * Validate entire log structure against Datadog limits
   */
  static validateLogStructure(structure: any): {
    valid: boolean
    warnings: string[]
    errors: string[]
  } {
    const warnings: string[] = []
    const errors: string[] = []

    // Check attribute count
    const attributeCount = this.countAttributes(structure)
    if (attributeCount > DATADOG_LIMITS.MAX_ATTRIBUTES) {
      warnings.push(
        `Log contains ${attributeCount} attributes, exceeding limit of ${DATADOG_LIMITS.MAX_ATTRIBUTES}`,
      )
    }

    // Check log size
    const logSize = this.calculateLogSize(structure)
    if (logSize > DATADOG_LIMITS.MAX_LOG_SIZE) {
      warnings.push(
        `Log size (${logSize} bytes) exceeds recommended limit of ${DATADOG_LIMITS.MAX_LOG_SIZE} bytes`,
      )
    }

    // Validate attribute keys and values
    this.validateObjectRecursively(structure, '', warnings, errors, 0)

    return {
      valid: errors.length === 0,
      warnings,
      errors,
    }
  }

  /**
   * Recursively validate object structure
   */
  private static validateObjectRecursively(
    obj: any,
    path: string,
    warnings: string[],
    errors: string[],
    depth: number,
  ): void {
    if (depth > DATADOG_LIMITS.MAX_NESTED_LEVELS) {
      errors.push(
        `Maximum nesting depth (${DATADOG_LIMITS.MAX_NESTED_LEVELS}) exceeded at path: ${path}`,
      )
      return
    }

    if (typeof obj !== 'object' || obj === null) {
      return
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const currentPath = path ? `${path}.${key}` : key

        // Validate key length
        if (!this.validateAttributeKey(key)) {
          warnings.push(`Attribute key too long at path: ${currentPath}`)
        }

        // Validate value
        const value = obj[key]
        if (typeof value === 'string' && value.length > DATADOG_LIMITS.MAX_ATTRIBUTE_VALUE_LENGTH) {
          warnings.push(`Attribute value too long at path: ${currentPath}`)
        }

        // Recursively validate nested objects
        if (typeof value === 'object' && value !== null) {
          this.validateObjectRecursively(value, currentPath, warnings, errors, depth + 1)
        }
      }
    }
  }

  /**
   * Sanitize a log structure to fit Datadog limits
   */
  static sanitizeLogStructure(structure: any): any {
    const sanitized = JSON.parse(JSON.stringify(structure))

    // Truncate oversized values
    this.truncateOversizedValues(sanitized)

    // Limit nested depth
    this.limitNestedDepth(sanitized, 0)

    return sanitized
  }

  /**
   * Truncate values that exceed the maximum attribute value length
   */
  private static truncateOversizedValues(obj: any): void {
    if (typeof obj !== 'object' || obj === null) {
      return
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key]

        if (typeof value === 'string' && value.length > DATADOG_LIMITS.MAX_ATTRIBUTE_VALUE_LENGTH) {
          obj[key] = value.substring(0, DATADOG_LIMITS.MAX_ATTRIBUTE_VALUE_LENGTH - 3) + '...'
        } else if (typeof value === 'object' && value !== null) {
          this.truncateOversizedValues(value)
        }
      }
    }
  }

  /**
   * Limit nesting depth by flattening deeply nested objects
   */
  private static limitNestedDepth(obj: any, depth: number): void {
    if (depth >= DATADOG_LIMITS.MAX_NESTED_LEVELS) {
      // Convert deeply nested objects to strings
      for (const key in obj) {
        if (obj.hasOwnProperty(key) && typeof obj[key] === 'object' && obj[key] !== null) {
          obj[key] = '[Object: max depth exceeded]'
        }
      }
      return
    }

    if (typeof obj !== 'object' || obj === null) {
      return
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key) && typeof obj[key] === 'object' && obj[key] !== null) {
        this.limitNestedDepth(obj[key], depth + 1)
      }
    }
  }

  /**
   * Validate business identifiers (intent hash, quote ID, etc.)
   */
  static validateBusinessIdentifiers(identifiers: Record<string, any>): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    // Validate intent hash format (if present)
    if (identifiers.intentHash && typeof identifiers.intentHash === 'string') {
      if (!/^0x[a-fA-F0-9]{64}$/.test(identifiers.intentHash)) {
        errors.push('Intent hash must be a valid 32-byte hex string with 0x prefix')
      }
    }

    // Validate wallet address format (if present)
    if (identifiers.walletAddress && typeof identifiers.walletAddress === 'string') {
      if (!/^0x[a-fA-F0-9]{40}$/.test(identifiers.walletAddress)) {
        errors.push('Wallet address must be a valid 20-byte hex string with 0x prefix')
      }
    }

    // Validate token addresses (if present)
    const tokenFields = ['tokenInAddress', 'tokenOutAddress']
    for (const field of tokenFields) {
      if (identifiers[field] && typeof identifiers[field] === 'string') {
        if (!/^0x[a-fA-F0-9]{40}$/.test(identifiers[field])) {
          errors.push(`${field} must be a valid 20-byte hex string with 0x prefix`)
        }
      }
    }

    // Validate chain IDs (if present)
    const chainFields = ['sourceChainId', 'destinationChainId']
    for (const field of chainFields) {
      if (identifiers[field] !== undefined) {
        const chainId = identifiers[field]
        if (typeof chainId !== 'number' || chainId <= 0 || !Number.isInteger(chainId)) {
          errors.push(`${field} must be a positive integer`)
        }
      }
    }

    // Validate amounts (if present)
    const amountFields = ['amountIn', 'amountOut', 'nativeValue']
    for (const field of amountFields) {
      if (identifiers[field] && typeof identifiers[field] === 'string') {
        if (!/^\d+$/.test(identifiers[field])) {
          errors.push(`${field} must be a numeric string representing wei amount`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}
