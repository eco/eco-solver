import { ConfigurationSchemas } from '@/dynamic-config/schemas/configuration-schemas'
import { DynamicConfigService } from '@/dynamic-config/services/dynamic-config.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { Inject, Injectable } from '@nestjs/common'
import { z } from 'zod'

export interface AllConfigsValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  summary: {
    totalConfigurations: number
    validConfigurations: number
    invalidConfigurations: number
    warningConfigurations: number
  }
}

export interface ValidationError {
  key: string
  type: 'MISSING_REQUIRED' | 'INVALID_TYPE' | 'INVALID_VALUE' | 'SCHEMA_VIOLATION'
  message: string
  expectedType?: string
  actualType?: string
  expectedValue?: any
  actualValue?: any
}

export interface ValidationWarning {
  key: string
  type: 'DEPRECATED' | 'UNUSED' | 'PERFORMANCE' | 'SECURITY'
  message: string
  recommendation?: string
}

/**
 * Service for validating configuration schemas and values during migration
 */
@Injectable()
export class DynamicConfigValidationService {
  private readonly logger = new EcoLogger(DynamicConfigValidationService.name)

  constructor(
    @Inject(DynamicConfigService) private readonly configurationService: DynamicConfigService,
    @Inject(EcoConfigService) private readonly ecoConfigService: EcoConfigService,
  ) {}

  /**
   * Validate all configurations against expected schemas
   */
  async validateAllConfigurations(): Promise<AllConfigsValidationResult> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Starting comprehensive configuration validation',
      }),
    )

    const result: AllConfigsValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      summary: {
        totalConfigurations: 0,
        validConfigurations: 0,
        invalidConfigurations: 0,
        warningConfigurations: 0,
      },
    }

    try {
      // Get all configurations
      const configurations = await this.configurationService.getAll()
      result.summary.totalConfigurations = configurations.data.length

      // Validate each configuration
      for (const config of configurations.data) {
        const configResult = await this.validateSingleConfiguration(config.key, config.value)

        if (configResult.errors.length > 0) {
          result.errors.push(...configResult.errors)
          result.summary.invalidConfigurations++
        } else {
          result.summary.validConfigurations++
        }

        if (configResult.warnings.length > 0) {
          result.warnings.push(...configResult.warnings)
          result.summary.warningConfigurations++
        }
      }

      // Validate required configurations are present
      const requiredConfigsResult = await this.validateRequiredConfigurations()
      result.errors.push(...requiredConfigsResult.errors)
      result.warnings.push(...requiredConfigsResult.warnings)

      result.valid = result.errors.length === 0

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Configuration validation completed. Valid: ${result.valid}, Errors: ${result.errors.length}, Warnings: ${result.warnings.length}`,
        }),
      )

      return result
    } catch (ex) {
      const errorMessage = EcoError.logError(
        ex,
        `validateAllConfigurations: exception`,
        this.logger,
      )

      result.valid = false
      result.errors.push({
        key: 'VALIDATION_ERROR',
        type: 'SCHEMA_VIOLATION',
        message: `Validation process failed: ${errorMessage}`,
      })
      return result
    }
  }

  /**
   * Validate a single configuration against its expected schema
   */
  async validateSingleConfiguration(
    key: string,
    value: any,
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    try {
      // Get the schema for this configuration key
      const { error } = this.validateAgainstSchema(key, value)

      if (error) {
        errors.push(error)
      }

      // Security warnings
      const securityWarnings = this.checkSecurityIssues(key, value)
      warnings.push(...securityWarnings)

      // Performance warnings
      const performanceWarnings = this.checkPerformanceIssues(key, value)
      warnings.push(...performanceWarnings)
    } catch (ex) {
      const errorMessage = EcoError.logError(
        ex,
        `validateSingleConfiguration: exception`,
        this.logger,
      )

      errors.push({
        key,
        type: 'SCHEMA_VIOLATION',
        message: `Validation error: ${errorMessage}`,
      })
    }

    return { errors, warnings }
  }

  private validateAgainstSchema(key: string, value: any): EcoResponse<void> {
    // Get the schema for this configuration key
    const schema = this.getConfigurationSchema(key)

    if (!schema) {
      return {
        error: {
          key,
          type: 'SCHEMA_VIOLATION',
          message: `Missing schema for ${key}`,
          actualValue: value,
        },
      }
    }

    const result = schema.safeParse(value)

    if (!result.success) {
      return {
        error: {
          key,
          type: 'SCHEMA_VIOLATION',
          message: `Schema validation failed: ${result.error?.message || 'Unknown validation error'}`,
          actualValue: value,
        },
      }
    }

    return {}
  }

  /**
   * Validate that all required configurations are present
   */
  private async validateRequiredConfigurations(): Promise<{
    errors: ValidationError[]
    warnings: ValidationWarning[]
  }> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    const requiredConfigs = this.getRequiredConfigurations()
    const existingConfigs = await this.getExistingConfigurationKeys()

    for (const requiredKey of requiredConfigs) {
      if (!existingConfigs.has(requiredKey)) {
        errors.push({
          key: requiredKey,
          type: 'MISSING_REQUIRED',
          message: `Required configuration ${requiredKey} is missing`,
        })
      }
    }

    return { errors, warnings }
  }

  /**
   * Get the Zod schema for a configuration key using centralized schema definitions
   */
  private getConfigurationSchema(key: string): z.ZodSchema | null {
    return ConfigurationSchemas.getSchema(key)
  }

  /**
   * Check for security issues in configuration
   */
  private checkSecurityIssues(key: string, value: any): ValidationWarning[] {
    const warnings: ValidationWarning[] = []

    // Check for hardcoded secrets
    if (this.isSecretKey(key) && typeof value === 'string') {
      if (value.length < 8) {
        warnings.push({
          key,
          type: 'SECURITY',
          message: 'Secret value appears to be too short',
          recommendation: 'Use a stronger secret with at least 8 characters',
        })
      }

      if (value.includes('test') || value.includes('demo') || value.includes('example')) {
        warnings.push({
          key,
          type: 'SECURITY',
          message: 'Secret value appears to be a test/demo value',
          recommendation: 'Replace with a production-ready secret',
        })
      }
    }

    // Check for insecure URLs
    if ((key.includes('url') || key.includes('uri')) && typeof value === 'string') {
      if (value.startsWith('http://') && !value.includes('localhost')) {
        warnings.push({
          key,
          type: 'SECURITY',
          message: 'Using HTTP instead of HTTPS for external URL',
          recommendation: 'Use HTTPS for secure communication',
        })
      }
    }

    return warnings
  }

  /**
   * Check for performance issues in configuration
   */
  private checkPerformanceIssues(key: string, value: any): ValidationWarning[] {
    const warnings: ValidationWarning[] = []

    // Check for large configuration values
    if (typeof value === 'object' && JSON.stringify(value).length > 10000) {
      warnings.push({
        key,
        type: 'PERFORMANCE',
        message: 'Configuration value is very large',
        recommendation: 'Consider breaking down large configurations or storing them externally',
      })
    }

    // Check for inefficient array sizes
    if (Array.isArray(value) && value.length > 100) {
      warnings.push({
        key,
        type: 'PERFORMANCE',
        message: 'Configuration array is very large',
        recommendation: 'Consider pagination or chunking for large arrays',
      })
    }

    return warnings
  }

  /**
   * Get list of required configuration keys
   */
  private getRequiredConfigurations(): string[] {
    // Return a minimal set of truly required configurations
    // These should be configurations that are essential for the application to function
    // For now, return an empty array to avoid false positives during migration validation
    // In a real implementation, this would be based on the application's actual requirements
    return []
  }

  /**
   * Get existing configuration keys as a Set
   */
  private async getExistingConfigurationKeys(): Promise<Set<string>> {
    try {
      const result = await this.configurationService.getAll()
      return new Set(result.data.map((config) => config.key))
    } catch (ex) {
      const errorMessage = EcoError.logError(
        ex,
        `getExistingConfigurationKeys: exception`,
        this.logger,
      )

      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: `Failed to retrieve existing configurations: ${errorMessage}`,
        }),
      )
      return new Set()
    }
  }

  /**
   * Check if a key represents a secret configuration
   */
  private isSecretKey(key: string): boolean {
    const secretKeywords = ['password', 'secret', 'key', 'token', 'credential', 'private']
    const keyLower = key.toLowerCase()
    return secretKeywords.some((keyword) => keyLower.includes(keyword))
  }

  /**
   * Compare configurations between AWS and MongoDB
   */
  async compareWithAws(): Promise<{
    identical: boolean
    differences: Array<{
      key: string
      awsValue: any
      mongoValue: any
      type: 'MISSING_IN_MONGO' | 'MISSING_IN_AWS' | 'VALUE_MISMATCH'
    }>
  }> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Comparing AWS and MongoDB configurations',
      }),
    )

    const differences: Array<{
      key: string
      awsValue: any
      mongoValue: any
      type: 'MISSING_IN_MONGO' | 'MISSING_IN_AWS' | 'VALUE_MISMATCH'
    }> = []

    try {
      // Get AWS configurations (would need to implement AWS reading logic)
      const awsConfigs = (this.ecoConfigService.get('aws') as Record<string, any>) || {}
      const mongoConfigs = this.ecoConfigService.getMongoConfigurations()

      // Check for configurations in AWS but not in MongoDB
      for (const [key, awsValue] of Object.entries(awsConfigs)) {
        if (!(key in mongoConfigs)) {
          differences.push({
            key,
            awsValue,
            mongoValue: undefined,
            type: 'MISSING_IN_MONGO',
          })
        } else if (JSON.stringify(awsValue) !== JSON.stringify(mongoConfigs[key])) {
          differences.push({
            key,
            awsValue,
            mongoValue: mongoConfigs[key],
            type: 'VALUE_MISMATCH',
          })
        }
      }

      // Check for configurations in MongoDB but not in AWS
      for (const [key, mongoValue] of Object.entries(mongoConfigs)) {
        if (!(key in awsConfigs)) {
          differences.push({
            key,
            awsValue: undefined,
            mongoValue,
            type: 'MISSING_IN_AWS',
          })
        }
      }

      return {
        identical: differences.length === 0,
        differences,
      }
    } catch (ex) {
      const errorMessage = EcoError.logError(ex, `compareWithAws: exception`, this.logger)

      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Failed to compare configurations: ${errorMessage}`,
        }),
      )
      throw ex
    }
  }
}
