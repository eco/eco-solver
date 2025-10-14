import { CreateConfigurationDTO } from '@/dynamic-config/interfaces/configuration-repository.interface'
import { DynamicConfigService } from '@/dynamic-config/services/dynamic-config.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { Injectable, Logger, Inject } from '@nestjs/common'
import { SecretsManager } from '@aws-sdk/client-secrets-manager'

export interface MigrationResult {
  success: boolean
  migratedCount: number
  skippedCount: number
  errorCount: number
  errors: Array<{
    key: string
    error: string
  }>
  summary: {
    totalConfigurations: number
    newConfigurations: number
    existingConfigurations: number
  }
}

export interface MigrationOptions {
  dryRun?: boolean
  overwriteExisting?: boolean
  keyPrefix?: string
  userId?: string
  keys?: string // Comma-separated list of top-level keys
  keysFile?: string // Path to file containing keys
  migrateAll?: boolean // Explicit flag to migrate all keys
}

/**
 * Service for migrating configuration data from AWS Secrets Manager to MongoDB
 */
@Injectable()
export class AwsToMongoDbMigrationService {
  private readonly logger = new Logger(AwsToMongoDbMigrationService.name)

  constructor(
    @Inject(DynamicConfigService) private readonly configurationService: DynamicConfigService,
    @Inject(EcoConfigService) private readonly ecoConfigService: EcoConfigService,
  ) {}

  /**
   * Migrate all AWS configurations to MongoDB
   */
  async migrateFromAws(options: MigrationOptions = {}): Promise<MigrationResult> {
    const {
      dryRun = false,
      overwriteExisting = false,
      keyPrefix = '',
      userId = 'migration-script',
      keys,
      keysFile,
      migrateAll = false,
    } = options

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Starting AWS to MongoDB migration${dryRun ? ' (DRY RUN)' : ''}`,
      }),
    )

    const result: MigrationResult = {
      success: false,
      migratedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
      summary: {
        totalConfigurations: 0,
        newConfigurations: 0,
        existingConfigurations: 0,
      },
    }

    try {
      // Get AWS configurations
      const allAwsConfigurations = await this.extractAwsConfigurations()

      // Filter configurations by specified keys
      const awsConfigurations = await this.filterConfigurationsByKeys(allAwsConfigurations, {
        keys,
        keysFile,
        migrateAll,
      })

      result.summary.totalConfigurations = Object.keys(awsConfigurations).length

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Found ${Object.keys(allAwsConfigurations).length} total AWS configurations, ${result.summary.totalConfigurations} selected for migration`,
        }),
      )

      // Get existing MongoDB configurations to check for conflicts
      const existingConfigs = await this.getExistingMongoConfigurations()

      // Process each configuration
      for (const [key, value] of Object.entries(awsConfigurations)) {
        const fullKey = keyPrefix ? `${keyPrefix}.${key}` : key

        try {
          // Check if configuration already exists
          const exists = existingConfigs.has(fullKey)
          if (exists) {
            result.summary.existingConfigurations++
            if (!overwriteExisting) {
              result.skippedCount++
              this.logger.debug(
                EcoLogMessage.fromDefault({
                  message: `Skipping existing configuration: ${fullKey}`,
                }),
              )
              continue
            }
          } else {
            result.summary.newConfigurations++
          }

          // Create configuration DTO
          const configDTO = this.createConfigurationDTO(fullKey, value)

          if (!dryRun) {
            if (exists && overwriteExisting) {
              await this.configurationService.update(fullKey, { value }, userId)
            } else {
              await this.configurationService.create(configDTO, userId)
            }
          }

          result.migratedCount++
          this.logger.debug(
            EcoLogMessage.fromDefault({
              message: `${dryRun ? '[DRY RUN] ' : ''}Migrated configuration: ${fullKey}`,
            }),
          )
        } catch (error) {
          result.errorCount++
          result.errors.push({
            key: fullKey,
            error: error.message,
          })
          this.logger.error(
            EcoLogMessage.fromDefault({
              message: `Failed to migrate configuration ${fullKey}: ${error.message}`,
            }),
          )
        }
      }

      result.success = result.errorCount === 0

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Migration completed${dryRun ? ' (DRY RUN)' : ''}. Migrated: ${result.migratedCount}, Skipped: ${result.skippedCount}, Errors: ${result.errorCount}`,
        }),
      )

      return result
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Migration failed: ${error.message}`,
        }),
      )
      result.success = false
      result.errors.push({
        key: 'MIGRATION_ERROR',
        error: error.message,
      })
      return result
    }
  }

  /**
   * Extract all configurations from AWS Secrets Manager
   */
  private async extractAwsConfigurations(): Promise<Record<string, any>> {
    // Debug: Check if ecoConfigService is available
    if (!this.ecoConfigService) {
      throw new Error('EcoConfigService is not available')
    }

    // Debug: Check if getAwsConfigs method exists
    if (typeof this.ecoConfigService.getAwsConfigs !== 'function') {
      throw new Error('EcoConfigService.getAwsConfigs method is not available')
    }

    const awsCredentials = this.ecoConfigService.getAwsConfigs()

    // Debug: Check if AWS credentials are available
    if (!awsCredentials) {
      this.logger.warn('No AWS credentials available from EcoConfigService')
      return {}
    }

    if (!Array.isArray(awsCredentials) || awsCredentials.length === 0) {
      this.logger.warn('AWS credentials array is empty or invalid')
      return {}
    }

    this.logger.log(`Found ${awsCredentials.length} AWS credential(s) for migration`)
    const allConfigurations: Record<string, any> = {}

    for (const credential of awsCredentials) {
      try {
        const secretsManager = new SecretsManager({
          region: credential.region,
        })

        const data = await secretsManager.getSecretValue({ SecretId: credential.secretID })
        if (data.SecretString) {
          const secrets = JSON.parse(data.SecretString)
          Object.assign(allConfigurations, secrets)
        }
      } catch (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `Failed to retrieve AWS secret ${credential.secretID}: ${error.message}`,
          }),
        )
      }
    }

    return allConfigurations
  }

  /**
   * Filter configurations by specified keys
   */
  private async filterConfigurationsByKeys(
    configurations: Record<string, any>,
    options: { keys?: string; keysFile?: string; migrateAll?: boolean },
  ): Promise<Record<string, any>> {
    const { keys, keysFile, migrateAll } = options

    // If migrate-all is explicitly set or no filtering options provided, return all
    if (migrateAll || (!keys && !keysFile)) {
      return configurations
    }

    let allowedKeys: string[] = []

    // Parse keys from command line
    if (keys) {
      allowedKeys = keys
        .split(',')
        .map((key) => key.trim())
        .filter((key) => key.length > 0)
    }

    // Parse keys from file
    if (keysFile) {
      try {
        const fs = await import('fs/promises')
        const fileContent = await fs.readFile(keysFile, 'utf-8')
        const fileKeys = fileContent
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && !line.startsWith('#')) // Allow comments
        allowedKeys = [...allowedKeys, ...fileKeys]
      } catch (error) {
        this.logger.error(`Failed to read keys file ${keysFile}: ${error.message}`)
        throw new Error(`Cannot read keys file: ${keysFile}`)
      }
    }

    // Remove duplicates
    allowedKeys = [...new Set(allowedKeys)]

    if (allowedKeys.length === 0) {
      this.logger.warn('No keys specified for migration, nothing to migrate')
      return {}
    }

    this.logger.log(`Filtering configurations for keys: ${allowedKeys.join(', ')}`)

    // Filter configurations by top-level keys
    const filteredConfigurations: Record<string, any> = {}

    for (const allowedKey of allowedKeys) {
      if (configurations[allowedKey] !== undefined) {
        filteredConfigurations[allowedKey] = configurations[allowedKey]
      } else {
        this.logger.warn(`No configuration found for key: ${allowedKey}`)
      }
    }

    return filteredConfigurations
  }

  /**
   * Get existing MongoDB configurations as a Set for quick lookup
   */
  private async getExistingMongoConfigurations(): Promise<Set<string>> {
    try {
      const result = await this.configurationService.getAll()
      return new Set(result.data.map((config) => config.key))
    } catch (error) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: `Failed to retrieve existing MongoDB configurations: ${error.message}`,
        }),
      )
      return new Set()
    }
  }

  /**
   * Create a configuration DTO from key-value pair
   */
  private createConfigurationDTO(key: string, value: any): CreateConfigurationDTO {
    const type = this.inferConfigurationType(value)
    const isSecret = this.isSecretConfiguration(key, value)

    return {
      key,
      value,
      type,
      isSecret,
      isRequired: this.isRequiredConfiguration(key),
      description: `Migrated from AWS Secrets Manager - ${key}`,
    }
  }

  /**
   * Infer the configuration type from the value
   */
  private inferConfigurationType(value: any): 'string' | 'number' | 'boolean' | 'object' | 'array' {
    if (Array.isArray(value)) {
      return 'array'
    }
    if (value !== null && typeof value === 'object') {
      return 'object'
    }
    if (typeof value === 'boolean') {
      return 'boolean'
    }
    if (typeof value === 'number') {
      return 'number'
    }
    return 'string'
  }

  /**
   * Determine if a configuration should be marked as secret
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private isSecretConfiguration(key: string, value: any): boolean {
    const secretKeywords = [
      'password',
      'secret',
      'key',
      'token',
      'credential',
      'auth',
      'private',
      'api_key',
      'apikey',
    ]

    const keyLower = key.toLowerCase()
    return secretKeywords.some((keyword) => keyLower.includes(keyword))
  }

  /**
   * Determine if a configuration is required for application startup
   */
  private isRequiredConfiguration(key: string): boolean {
    const requiredKeywords = [
      'database',
      'redis',
      'server',
      'port',
      'mongodb',
      'connection',
      'uri',
      'url',
    ]

    const keyLower = key.toLowerCase()
    return requiredKeywords.some((keyword) => keyLower.includes(keyword))
  }

  /**
   * Validate migrated configurations by comparing with AWS
   */
  async validateMigration(): Promise<{
    valid: boolean
    missingKeys: string[]
    mismatchedValues: Array<{ key: string; awsValue: any; mongoValue: any }>
  }> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Starting migration validation',
      }),
    )

    const awsConfigurations = await this.extractAwsConfigurations()
    const mongoConfigurations = this.ecoConfigService.getMongoConfigurations()

    const missingKeys: string[] = []
    const mismatchedValues: Array<{ key: string; awsValue: any; mongoValue: any }> = []

    for (const [key, awsValue] of Object.entries(awsConfigurations)) {
      if (!(key in mongoConfigurations)) {
        missingKeys.push(key)
      } else {
        const mongoValue = mongoConfigurations[key]
        if (JSON.stringify(awsValue) !== JSON.stringify(mongoValue)) {
          mismatchedValues.push({ key, awsValue, mongoValue })
        }
      }
    }

    const valid = missingKeys.length === 0 && mismatchedValues.length === 0

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Migration validation completed. Valid: ${valid}, Missing: ${missingKeys.length}, Mismatched: ${mismatchedValues.length}`,
      }),
    )

    return {
      valid,
      missingKeys,
      mismatchedValues,
    }
  }

  /**
   * Create a rollback plan for the migration
   */
  async createRollbackPlan(): Promise<{
    configurationsToDelete: string[]
    configurationsToRestore: Array<{ key: string; originalValue: any }>
  }> {
    const awsConfigurations = await this.extractAwsConfigurations()

    // Get configurations from MongoDB database (not EcoConfigService cache)
    const mongoConfigsResult = await this.configurationService.getAll()
    const mongoConfigKeys = new Set(mongoConfigsResult.data.map((config) => config.key))

    const configurationsToDelete = Object.keys(awsConfigurations).filter((key) =>
      mongoConfigKeys.has(key),
    )

    this.logger.log(
      `Rollback plan: Found ${configurationsToDelete.length} configurations to delete: ${configurationsToDelete.join(', ')}`,
    )

    // For now, we don't track original values, so restore would be empty
    // In a production system, you'd want to backup original values before migration
    const configurationsToRestore: Array<{ key: string; originalValue: any }> = []

    return {
      configurationsToDelete,
      configurationsToRestore,
    }
  }

  /**
   * Execute rollback plan
   */
  async executeRollback(
    rollbackPlan: {
      configurationsToDelete: string[]
      configurationsToRestore: Array<{ key: string; originalValue: any }>
    },
    userId = 'rollback-script',
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = []

    // Delete migrated configurations
    for (const key of rollbackPlan.configurationsToDelete) {
      try {
        await this.configurationService.delete(key, userId)
      } catch (error) {
        errors.push(`Failed to delete ${key}: ${error.message}`)
      }
    }

    // Restore original configurations
    for (const { key, originalValue } of rollbackPlan.configurationsToRestore) {
      try {
        await this.configurationService.create(
          {
            key,
            value: originalValue,
            type: this.inferConfigurationType(originalValue),
            isSecret: this.isSecretConfiguration(key, originalValue),
            isRequired: this.isRequiredConfiguration(key),
            description: 'Restored from rollback',
          },
          userId,
        )
      } catch (error) {
        errors.push(`Failed to restore ${key}: ${error.message}`)
      }
    }

    return {
      success: errors.length === 0,
      errors,
    }
  }
}
