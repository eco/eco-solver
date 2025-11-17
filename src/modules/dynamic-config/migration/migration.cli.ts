import {
  AwsToMongoDbMigrationService,
  MigrationOptions,
} from '@/modules/dynamic-config/migration/aws-to-mongodb-migration.service';
import { Command } from 'commander';
import { DynamicConfigValidationService } from '@/modules/dynamic-config/migration/dynamic-config-validation.service';
import { ConfigFactory } from '@/config/config-factory';
import { EcoError } from '@/errors/eco-error';
import { Logger } from '@nestjs/common';
import { MigrationModule } from '@/modules/dynamic-config/migration/migration.module';
import { NestFactory } from '@nestjs/core';

/**
 * CLI tool for migrating configurations from AWS Secrets Manager to MongoDB
 */
class MigrationCLI {
  private logger = new Logger(MigrationCLI.name);

  private async createApp() {
    try {
      this.logger.log('Creating NestJS application context...');
      const app = await NestFactory.createApplicationContext(MigrationModule.forRoot(), {
        logger: ['error', 'warn', 'log'],
      });

      this.logger.log('Application context created successfully');
      await ConfigFactory.loadConfig();
      return app;
    } catch (ex) {
      EcoError.logErrorWithStack(ex, `Failed to create application context`, this.logger);
      throw ex;
    }
  }

  async run() {
    const program = new Command();

    program
      .name('config-migration')
      .description('Migrate and validate configurations from AWS Secrets Manager to MongoDB')
      .version('1.0.0');

    program
      .command('migrate')
      .description('Migrate AWS configurations to MongoDB')
      .option('--dry-run', 'Run migration without making changes', false)
      .option('--overwrite', 'Overwrite existing configurations', false)

      .option('--key-prefix <prefix>', 'Add prefix to all configuration keys', '')
      .option('--user-id <userId>', 'User ID for audit logging', 'migration-cli')
      .option(
        '--keys <keys>',
        'Comma-separated list of top-level keys to migrate (e.g., "database,redis,server")',
      )
      .option(
        '--keys-file <file>',
        'File containing list of top-level keys to migrate (one per line)',
      )
      .option('--migrate-all', 'Explicitly migrate all configurations (default behavior)', false)
      .action(async (options) => {
        // Validate key filtering options
        const hasKeyFilter = options.keys || options.keysFile;
        if (hasKeyFilter && options.migrateAll) {
          this.logger.error('Cannot use --migrate-all with --keys or --keys-file options');
          process.exit(1);
        }

        await this.executeMigration({
          dryRun: options.dryRun,
          overwriteExisting: options.overwrite,
          userId: options.userId,
          keys: options.keys,
          keysFile: options.keysFile,
          migrateAll: options.migrateAll,
        });
      });

    program
      .command('validate')
      .description('Validate migrated configurations against AWS')
      .action(async () => {
        await this.validateMigration();
      });

    program
      .command('validate-all')
      .description(
        'Comprehensive validation of all configurations (schemas, security, performance)',
      )
      .action(async () => {
        await this.validateAllConfigurations();
      });

    program
      .command('rollback')
      .description('Rollback migration by removing migrated configurations')
      .option('--user-id <userId>', 'User ID for audit logging', 'rollback-cli')
      .action(async (options: any) => {
        await this.executeRollback(options.userId);
      });

    program
      .command('status')
      .description('Show migration status and configuration sources')
      .action(async () => {
        await this.showStatus();
      });

    program.parse(process.argv);
  }

  private async executeMigration(options: MigrationOptions) {
    this.logger.log('Starting configuration migration...');

    try {
      const app = await this.createApp();
      const migrationService = app.get(AwsToMongoDbMigrationService);
      const result = await migrationService.migrateFromAws(options);

      this.printMigrationResult(result, options.dryRun);

      await app.close();
      process.exit(result.success ? 0 : 1);
    } catch (ex) {
      EcoError.logErrorWithStack(ex, `Migration failed`, this.logger);
      process.exit(1);
    }
  }

  private async validateMigration() {
    this.logger.log('Validating migration...');

    try {
      const app = await this.createApp();

      const migrationService = app.get(AwsToMongoDbMigrationService);
      const validation = await migrationService.validateMigration();

      this.printValidationResult(validation);

      await app.close();
      process.exit(validation.valid ? 0 : 1);
    } catch (ex) {
      EcoError.logErrorWithStack(ex, `Validation failed`, this.logger);
      process.exit(1);
    }
  }

  private async validateAllConfigurations() {
    this.logger.log('Running comprehensive configuration validation...');

    try {
      const app = await this.createApp();

      const validationService = app.get(DynamicConfigValidationService);
      const result = await validationService.validateAllConfigurations();

      this.printComprehensiveValidationResult(result);

      await app.close();
      process.exit(result.valid ? 0 : 1);
    } catch (ex) {
      EcoError.logErrorWithStack(ex, `Comprehensive validation failed`, this.logger);
      process.exit(1);
    }
  }

  private async executeRollback(userId: string) {
    this.logger.log('Starting migration rollback...');

    try {
      const app = await this.createApp();

      const migrationService = app.get(AwsToMongoDbMigrationService);

      // Create rollback plan
      const rollbackPlan = await migrationService.createRollbackPlan();

      this.logger.log(
        `Rollback plan: ${rollbackPlan.configurationsToDelete.length} configurations to delete`,
      );

      // Execute rollback
      const result = await migrationService.executeRollback(rollbackPlan, userId);

      if (result.success) {
        this.logger.log('Rollback completed successfully');
      } else {
        this.logger.error('Rollback completed with errors:');
        result.errors.forEach((error) => this.logger.error(`  - ${error}`));
      }

      await app.close();
      process.exit(result.success ? 0 : 1);
    } catch (ex) {
      EcoError.logErrorWithStack(ex, `Rollback failed`, this.logger);
      process.exit(1);
    }
  }

  private async showStatus() {
    this.logger.log('Checking configuration status...');

    try {
      const app = await this.createApp();

      try {
        const sources = ConfigFactory.getConfigurationSources();

        this.logger.log('\n=== Configuration Status ===');
        this.logger.log(`External configs: ${sources.external ? 'Available' : 'Not available'}`);
        this.logger.log(`Static configs: ${sources.static ? 'Available' : 'Not available'}`);
        this.logger.log(`MongoDB configs: ${sources.mongodb ? 'Available' : 'Not available'}`);
        this.logger.log(`MongoDB config count: ${sources.mongoConfigCount}`);
        this.logger.log(
          `MongoDB integration: ${ConfigFactory.isMongoConfigurationEnabled() ? 'Enabled' : 'Disabled'}`,
        );
      } catch (configError) {
        const errorMessage =
          configError instanceof Error ? configError.message : String(configError);
        this.logger.error(`Configuration access failed: ${errorMessage}`);
        this.logger.log('\n=== Configuration Status ===');
        this.logger.log('Unable to retrieve configuration status due to initialization errors');
        this.logger.log(
          'This may be normal if AWS credentials are not configured or MongoDB is not available',
        );
      }

      await app.close();
    } catch (ex) {
      EcoError.logErrorWithStack(ex, `Status check failed`, this.logger);
      process.exit(1);
    }
  }

  private printMigrationResult(result: any, dryRun?: boolean) {
    this.logger.log(`\n=== Migration Result${dryRun ? ' (DRY RUN)' : ''} ===`);
    this.logger.log(`Success: ${result.success}`);
    this.logger.log(`Total configurations: ${result.summary.totalConfigurations}`);
    this.logger.log(`New configurations: ${result.summary.newConfigurations}`);
    this.logger.log(`Existing configurations: ${result.summary.existingConfigurations}`);
    this.logger.log(`Migrated: ${result.migratedCount}`);
    this.logger.log(`Skipped: ${result.skippedCount}`);
    this.logger.log(`Errors: ${result.errorCount}`);

    if (result.errors.length > 0) {
      this.logger.log('\n=== Errors ===');
      result.errors.forEach((error: any) => {
        this.logger.log(`${error.key}: ${error.error}`);
      });
    }
  }

  private printValidationResult(validation: any) {
    this.logger.log('\n=== Validation Result ===');
    this.logger.log(`Valid: ${validation.valid}`);
    this.logger.log(`Missing keys: ${validation.missingKeys.length}`);
    this.logger.log(`Mismatched values: ${validation.mismatchedValues.length}`);

    if (validation.missingKeys.length > 0) {
      this.logger.log('\n=== Missing Keys ===');
      validation.missingKeys.forEach((key: string) => {
        this.logger.log(`- ${key}`);
      });
    }

    if (validation.mismatchedValues.length > 0) {
      this.logger.log('\n=== Mismatched Values ===');
      validation.mismatchedValues.forEach((mismatch: any) => {
        this.logger.log(`${mismatch.key}:`);
        this.logger.log(`  AWS: ${JSON.stringify(mismatch.awsValue)}`);
        this.logger.log(`  MongoDB: ${JSON.stringify(mismatch.mongoValue)}`);
      });
    }
  }

  private printComprehensiveValidationResult(result: any) {
    this.logger.log('\n=== Comprehensive Validation Result ===');
    this.logger.log(`Overall Valid: ${result.valid}`);
    this.logger.log(`Total Configurations: ${result.summary.totalConfigurations}`);
    this.logger.log(`Valid Configurations: ${result.summary.validConfigurations}`);
    this.logger.log(`Invalid Configurations: ${result.summary.invalidConfigurations}`);
    this.logger.log(`Configurations with Warnings: ${result.summary.warningConfigurations}`);
    this.logger.log(`Total Errors: ${result.errors.length}`);
    this.logger.log(`Total Warnings: ${result.warnings.length}`);

    if (result.errors.length > 0) {
      this.logger.log('\n=== Validation Errors ===');
      result.errors.forEach((error: any) => {
        this.logger.log(`${error.key} [${error.type}]: ${error.message}`);
        if (error.expectedType && error.actualType) {
          this.logger.log(`  Expected: ${error.expectedType}, Got: ${error.actualType}`);
        }
        if (error.actualValue !== undefined) {
          this.logger.log(`  Value: ${JSON.stringify(error.actualValue)}`);
        }
      });
    }

    if (result.warnings.length > 0) {
      this.logger.log('\n=== Validation Warnings ===');
      result.warnings.forEach((warning: any) => {
        this.logger.log(`${warning.key} [${warning.type}]: ${warning.message}`);
        if (warning.recommendation) {
          this.logger.log(`  Recommendation: ${warning.recommendation}`);
        }
      });
    }
  }
}

// Run the CLI if this file is executed directly
if (require.main === module) {
  const cli = new MigrationCLI();
  cli.run().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('CLI execution failed:', error);
    process.exit(1);
  });
}

export { MigrationCLI };
