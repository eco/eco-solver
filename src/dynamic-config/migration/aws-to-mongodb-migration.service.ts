import { ConfigurationType } from '@/modules/dynamic-config/enums/configuration-type.enum';
import { CreateConfigurationDTO } from '@/modules/dynamic-config/interfaces/configuration-repository.interface';
import { DynamicConfigService } from '@/modules/dynamic-config/services/dynamic-config.service';
import { EcoConfigService } from '@/config/eco-config.service';
import { EcoError } from '@/errors/eco-error';
import { EcoLogger } from '@/common/logging/eco-logger';
import { EcoLogMessage } from '@/common/logging/eco-log-message';
import { Inject, Injectable } from '@nestjs/common';

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: Array<{
    key: string;
    error: string;
  }>;
  summary: {
    totalConfigurations: number;
    newConfigurations: number;
    existingConfigurations: number;
  };
}

export interface MigrationOptions {
  dryRun?: boolean;
  overwriteExisting?: boolean;
  userId?: string;
  keys?: string; // Comma-separated list of top-level keys
  keysFile?: string; // Path to file containing keys
  migrateAll?: boolean; // Explicit flag to migrate all keys
}

/**
 * Service for migrating configuration data from AWS Secrets Manager to MongoDB
 */
@Injectable()
export class AwsToMongoDbMigrationService {
  private readonly logger = new EcoLogger(AwsToMongoDbMigrationService.name);

  constructor(
    @Inject(DynamicConfigService) private readonly configurationService: DynamicConfigService,
  ) {}

  /**
   * Migrate all AWS configurations to MongoDB
   */
  async migrateFromAws(options: MigrationOptions = {}): Promise<MigrationResult> {
    const {
      dryRun = false,
      overwriteExisting = false,
      userId = 'migration-script',
      keys,
      keysFile,
      migrateAll = false,
    } = options;

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Starting AWS to MongoDB migration${dryRun ? ' (DRY RUN)' : ''}`,
      }),
    );

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
    };

    try {
      // Get AWS configurations
      const allAwsConfigurations = await this.extractAwsConfigurations();

      // Filter configurations by specified keys
      const awsConfigurations = await this.filterConfigurationsByKeys(allAwsConfigurations, {
        keys,
        keysFile,
        migrateAll,
      });

      result.summary.totalConfigurations = Object.keys(awsConfigurations).length;

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Found ${Object.keys(allAwsConfigurations).length} total AWS configurations, ${result.summary.totalConfigurations} selected for migration`,
        }),
      );

      // Get existing MongoDB configurations to check for conflicts
      const existingConfigs = await this.getExistingMongoConfigurations();

      // Process each configuration
      for (const [key, value] of Object.entries(awsConfigurations)) {
        const fullKey = key;

        try {
          // Check if configuration already exists
          const exists = existingConfigs.has(fullKey);
          if (exists) {
            result.summary.existingConfigurations++;
            if (!overwriteExisting) {
              result.skippedCount++;
              this.logger.debug(
                EcoLogMessage.fromDefault({
                  message: `Skipping existing configuration: ${fullKey}`,
                }),
              );
              continue;
            }
          } else {
            result.summary.newConfigurations++;
          }

          // Create configuration DTO
          const configDTO = this.createConfigurationDTO(fullKey, value);

          if (!dryRun) {
            if (exists && overwriteExisting) {
              await this.configurationService.update(fullKey, { value }, userId);
            } else {
              await this.configurationService.create(configDTO, userId);
            }
          }

          result.migratedCount++;
          this.logger.debug(
            EcoLogMessage.fromDefault({
              message: `${dryRun ? '[DRY RUN] ' : ''}Migrated configuration: ${fullKey}`,
            }),
          );
        } catch (ex) {
          const errorMessage = EcoError.logError(
            ex,
            `Failed to migrate configuration`,
            this.logger,
            {
              key: fullKey,
            },
          );

          result.errorCount++;
          result.errors.push({
            key: fullKey,
            error: errorMessage,
          });
        }
      }

      result.success = result.errorCount === 0;

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Migration completed${dryRun ? ' (DRY RUN)' : ''}. Migrated: ${result.migratedCount}, Skipped: ${result.skippedCount}, Errors: ${result.errorCount}`,
        }),
      );

      return result;
    } catch (ex) {
      const errorMessage = EcoError.logError(ex, `Migration failed`, this.logger);
      result.success = false;
      result.errors.push({
        key: 'MIGRATION_ERROR',
        error: errorMessage,
      });
      return result;
    }
  }

  /**
   * Extract all configurations from AWS Secrets Manager
   */
  private async extractAwsConfigurations(): Promise<Record<string, any>> {
    let allConfigurations: Record<string, any> = {};

    try {
      allConfigurations = EcoConfigService.getAWSConfigValues();
    } catch (ex) {
      EcoError.logError(ex, `extractAwsConfigurations: exception`, this.logger);
      // throw ex
    }

    return allConfigurations;
  }

  /**
   * Filter configurations by specified keys
   */
  private async filterConfigurationsByKeys(
    configurations: Record<string, any>,
    options: { keys?: string; keysFile?: string; migrateAll?: boolean },
  ): Promise<Record<string, any>> {
    const { keys, keysFile, migrateAll } = options;

    // If migrate-all is explicitly set or no filtering options provided, return all
    if (migrateAll) {
      return configurations;
    }

    if (!keys && !keysFile) {
      this.logger.warn(
        'No keys specified. Use --migrate-all to migrate everything or provide --keys/--keys-file.',
      );
      return {};
    }

    let allowedKeys: string[] = [];

    // Parse keys from command line
    if (keys) {
      allowedKeys = keys
        .split(',')
        .map((key) => key.trim())
        .filter((key) => key.length > 0);
    }

    // Parse keys from file
    if (keysFile) {
      try {
        const fs = await import('fs/promises');
        const fileContent = await fs.readFile(keysFile, 'utf-8');
        const fileKeys = fileContent
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && !line.startsWith('#')); // Allow comments
        allowedKeys = [...allowedKeys, ...fileKeys];
      } catch (ex) {
        EcoError.logError(ex, `Failed to read keys file`, this.logger, {
          keysFile,
        });

        throw new Error(`Cannot read keys file: ${keysFile}`);
      }
    }

    // Remove duplicates
    allowedKeys = [...new Set(allowedKeys)];

    if (allowedKeys.length === 0) {
      this.logger.warn('No keys specified for migration, nothing to migrate');
      return {};
    }

    this.logger.log(`Filtering configurations for keys: ${allowedKeys.join(', ')}`);

    // Filter configurations by top-level keys
    const filteredConfigurations: Record<string, any> = {};

    for (const allowedKey of allowedKeys) {
      if (configurations[allowedKey] !== undefined) {
        filteredConfigurations[allowedKey] = configurations[allowedKey];
      } else {
        this.logger.warn(`No configuration found for key: ${allowedKey}`);
      }
    }

    return filteredConfigurations;
  }

  /**
   * Get existing MongoDB configurations as a Set for quick lookup
   */
  private async getExistingMongoConfigurations(): Promise<Set<string>> {
    try {
      const result = await this.configurationService.getAll();
      return new Set(result.data.map((config) => config.key));
    } catch (ex) {
      EcoError.logError(ex, `Failed to retrieve existing MongoDB configurations`, this.logger);

      return new Set();
    }
  }

  /**
   * Create a configuration DTO from key-value pair
   */
  private createConfigurationDTO(key: string, value: any): CreateConfigurationDTO {
    const type = this.inferConfigurationType(value);
    const isSecret = this.isSecretConfiguration(key, value);

    return {
      key,
      value,
      type,
      isSecret,
      isRequired: this.isRequiredConfiguration(key),
      description: `Migrated from AWS Secrets Manager - ${key}`,
    };
  }

  /**
   * Infer the configuration type from the value
   */
  private inferConfigurationType(value: any): 'string' | 'number' | 'boolean' | 'object' | 'array' {
    if (Array.isArray(value)) {
      return ConfigurationType.ARRAY;
    }
    if (value !== null && typeof value === 'object') {
      return ConfigurationType.OBJECT;
    }
    if (typeof value === 'boolean') {
      return ConfigurationType.BOOLEAN;
    }
    if (typeof value === 'number') {
      return ConfigurationType.NUMBER;
    }
    return ConfigurationType.STRING;
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
    ];

    const keyLower = key.toLowerCase();
    return secretKeywords.some((keyword) => keyLower.includes(keyword));
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
    ];

    const keyLower = key.toLowerCase();
    return requiredKeywords.some((keyword) => keyLower.includes(keyword));
  }

  /**
   * Validate migrated configurations by comparing with AWS
   */
  async validateMigration(): Promise<{
    valid: boolean;
    missingKeys: string[];
    mismatchedValues: Array<{ key: string; awsValue: any; mongoValue: any }>;
  }> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Starting migration validation',
      }),
    );

    const awsConfigurations = await this.extractAwsConfigurations();
    const mongoConfigurations = EcoConfigService.getMongoConfigurations();

    const missingKeys: string[] = [];
    const mismatchedValues: Array<{ key: string; awsValue: any; mongoValue: any }> = [];

    for (const [key, awsValue] of Object.entries(awsConfigurations)) {
      if (!(key in mongoConfigurations)) {
        missingKeys.push(key);
      } else {
        const mongoValue = mongoConfigurations[key];
        if (JSON.stringify(awsValue) !== JSON.stringify(mongoValue)) {
          mismatchedValues.push({ key, awsValue, mongoValue });
        }
      }
    }

    const valid = missingKeys.length === 0 && mismatchedValues.length === 0;

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Migration validation completed. Valid: ${valid}, Missing: ${missingKeys.length}, Mismatched: ${mismatchedValues.length}`,
      }),
    );

    return {
      valid,
      missingKeys,
      mismatchedValues,
    };
  }

  /**
   * Create a rollback plan for the migration
   */
  async createRollbackPlan(): Promise<{
    configurationsToDelete: string[];
    configurationsToRestore: Array<{ key: string; originalValue: any }>;
  }> {
    const awsConfigurations = await this.extractAwsConfigurations();

    // Get configurations from MongoDB database (not EcoConfigService cache)
    const mongoConfigsResult = await this.configurationService.getAll();
    const mongoConfigKeys = new Set(mongoConfigsResult.data.map((config) => config.key));

    const configurationsToDelete = Object.keys(awsConfigurations).filter((key) =>
      mongoConfigKeys.has(key),
    );

    this.logger.log(
      `Rollback plan: Found ${configurationsToDelete.length} configurations to delete: ${configurationsToDelete.join(', ')}`,
    );

    // For now, we don't track original values, so restore would be empty
    // In a production system, you'd want to backup original values before migration
    const configurationsToRestore: Array<{ key: string; originalValue: any }> = [];

    return {
      configurationsToDelete,
      configurationsToRestore,
    };
  }

  /**
   * Execute rollback plan
   */
  async executeRollback(
    rollbackPlan: {
      configurationsToDelete: string[];
      configurationsToRestore: Array<{ key: string; originalValue: any }>;
    },
    userId = 'rollback-script',
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Delete migrated configurations
    for (const key of rollbackPlan.configurationsToDelete) {
      try {
        await this.configurationService.delete(key, userId);
      } catch (ex) {
        const errorMessage = EcoError.logError(
          ex,
          `executeRollback: Failed to delete configuration ${key}`,
          this.logger,
        );

        errors.push(`Failed to delete ${key}: ${errorMessage}`);
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
        );
      } catch (ex) {
        const errorMessage = EcoError.logError(
          ex,
          `executeRollback: Failed to restore ${key}`,
          this.logger,
        );

        errors.push(`Failed to restore ${key}: ${errorMessage}`);
      }
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }
}
