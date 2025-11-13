import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class DynamicConfigSanitizerService {
  private readonly logger = new Logger(DynamicConfigSanitizerService.name)

  /**
   * Sanitize configuration value to prevent injection attacks
   */
  sanitizeValue(value: any): any {
    if (value === null || value === undefined) {
      return value
    }

    if (typeof value === 'string') {
      return this.sanitizeString(value)
    }

    if (value instanceof Date) {
      return new Date(value.getTime())
    }

    if (value instanceof Map || value instanceof Set) {
      return value
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item))
    }

    if (typeof value === 'object') {
      return this.sanitizeObject(value)
    }

    // Numbers, booleans, etc. are safe as-is
    return value
  }

  /**
   * Sanitize string values
   * Currently just trims whitespace, but can be enhanced for future security requirements
   */
  private sanitizeString(value: string): string {
    return value.trim()
  }

  /**
   * Sanitize object values recursively
   */
  private sanitizeObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }

    const sanitized: any = {}

    for (const [key, value] of Object.entries(obj)) {
      // Sanitize the key as well
      const sanitizedKey = this.sanitizeString(key.toString())

      // Validate the key before using it as a property name
      const keyValidation = this.validateConfigurationKey(sanitizedKey)
      if (!keyValidation.isValid) {
        this.logger.warn(`Skipping invalid key during sanitization: ${sanitizedKey}`)
        continue
      }

      sanitized[sanitizedKey] = this.sanitizeValue(value)
    }

    return sanitized
  }

  /**
   * Validate configuration key format
   */
  validateConfigurationKey(key: string): { isValid: boolean; error?: string } {
    if (!key || typeof key !== 'string') {
      return { isValid: false, error: 'Configuration key must be a non-empty string' }
    }

    // Check key format (alphanumeric, dots, underscores, hyphens)
    const keyPattern = /^[a-zA-Z0-9._-]+$/
    if (!keyPattern.test(key)) {
      return {
        isValid: false,
        error:
          'Configuration key can only contain letters, numbers, dots, underscores, and hyphens',
      }
    }

    // Check key length
    if (key.length > 100) {
      return {
        isValid: false,
        error: 'Configuration key cannot exceed 100 characters',
      }
    }

    // Prevent reserved keys
    const reservedKeys = ['__proto__', 'constructor', 'prototype']
    if (reservedKeys.includes(key.toLowerCase())) {
      return { isValid: false, error: 'Configuration key uses a reserved name' }
    }

    return { isValid: true }
  }

  /**
   * Detect potentially sensitive values based on key patterns only
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  detectSensitiveValue(key: string, value: any): boolean {
    const sensitiveKeyPatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /credential/i,
      /private/i,
      /auth/i,
    ]

    // Check if key suggests sensitive data
    return sensitiveKeyPatterns.some((pattern) => pattern.test(key))
  }
}
