# Configuration Migration Utilities

This directory contains utilities for migrating configuration data from AWS Secrets Manager to MongoDB.

## Prerequisites

### Zod Schema Validation

The validation service uses Zod for modern TypeScript-first schema validation. Zod is already installed and integrated, providing:

- ✅ **Type-safe validation** with excellent TypeScript inference
- ✅ **Descriptive error messages** for better debugging
- ✅ **Lightweight bundle** compared to alternatives
- ✅ **Modern API** with intuitive schema definitions

## Overview

The migration system provides:

1. **AWS to MongoDB Migration** - Migrate existing configurations from AWS Secrets Manager to MongoDB
2. **Configuration Validation** - Validate configurations against expected schemas and business rules
3. **Migration Verification** - Compare AWS and MongoDB configurations to ensure consistency
4. **Rollback Support** - Rollback migrations if needed

## Components

### AwsToMongoDbMigrationService

Main service for migrating configurations from AWS Secrets Manager to MongoDB.

**Features:**

- Extracts configurations from AWS Secrets Manager
- Transforms and validates configuration data
- Handles type inference and metadata generation
- Supports dry-run mode for testing
- Provides rollback capabilities
- Comprehensive error handling and logging

### DynamicConfigValidationService

Service for validating configuration schemas and values.

**Features:**

- Schema validation using Zod
- Type validation
- Business rule validation
- Security issue detection
- Performance issue detection
- AWS vs MongoDB comparison

### Migration CLI

Command-line interface for running migrations and validations.

## Usage

### Prerequisites

1. Ensure MongoDB is running and accessible
2. AWS credentials are configured for accessing Secrets Manager
3. Application is built (`npm run build`)

### Running Migrations

#### Basic Migration

```bash
# Migrate all AWS configurations to MongoDB
npm run migrate-config migrate

# Dry run (preview changes without applying)
npm run migrate-config migrate --dry-run

# Overwrite existing configurations
npm run migrate-config migrate --overwrite

# Exclude secret configurations
npm run migrate-config migrate --exclude-secrets

# Add prefix to all configuration keys
npm run migrate-config migrate --key-prefix "aws"
```

#### Validation

```bash
# Validate migrated configurations
npm run migrate-config validate

# Check migration status
npm run migrate-config status
```

#### Rollback

```bash
# Rollback migration (remove migrated configurations)
npm run migrate-config rollback
```

### Migration Options

| Option                  | Description                           | Default           |
| ----------------------- | ------------------------------------- | ----------------- |
| `--dry-run`             | Preview changes without applying them | `false`           |
| `--overwrite`           | Overwrite existing configurations     | `false`           |
| `--include-secrets`     | Include secret configurations         | `true`            |
| `--exclude-secrets`     | Exclude secret configurations         | `false`           |
| `--key-prefix <prefix>` | Add prefix to configuration keys      | `""`              |
| `--user-id <userId>`    | User ID for audit logging             | `"migration-cli"` |

### Programmatic Usage

```typescript
import { AwsToMongoDbMigrationService } from './aws-to-mongodb-migration.service'
import { DynamicConfigValidationService } from './dynamic-config-validation.service'

// Inject services via NestJS DI
constructor(
  private readonly migrationService: AwsToMongoDbMigrationService,
  private readonly validationService: DynamicConfigValidationService,
) {}

// Run migration
const result = await this.migrationService.migrateFromAws({
  dryRun: false,
  overwriteExisting: true,
  includeSecrets: true,
  userId: 'admin-user',
})

// Validate configurations
const validation = await this.validationService.validateAllConfigurations()

// Compare with AWS
const comparison = await this.validationService.compareWithAws()
```

## Migration Process

### 1. Pre-Migration

1. **Backup existing data** (if any MongoDB configurations exist)
2. **Review AWS configurations** to understand what will be migrated
3. **Run dry-run** to preview changes
4. **Validate AWS access** and MongoDB connectivity

### 2. Migration

1. **Extract configurations** from AWS Secrets Manager
2. **Transform data** (type inference, metadata generation)
3. **Validate configurations** against schemas
4. **Store in MongoDB** with proper audit logging
5. **Verify migration** by comparing AWS and MongoDB data

### 3. Post-Migration

1. **Validate all configurations** using validation service
2. **Test application startup** with MongoDB configurations
3. **Monitor application behavior** for any issues
4. **Update deployment scripts** to use MongoDB configurations

### 4. Rollback (if needed)

1. **Create rollback plan** identifying configurations to remove
2. **Execute rollback** to remove migrated configurations
3. **Verify rollback** by checking configuration state
4. **Restore AWS-based configuration** loading

## Configuration Types

The migration system handles various configuration types:

### Supported Types

- `string` - Text values, URLs, identifiers
- `number` - Numeric values, ports, timeouts
- `boolean` - True/false flags
- `object` - Complex nested configurations
- `array` - Lists of values or objects

### Type Inference Rules

- Numbers are detected by parsing and validation
- Booleans are detected by string matching (`true`, `false`)
- Objects are detected by JSON parsing
- Arrays are detected by JSON parsing and array check
- Everything else defaults to string

### Secret Detection

Configurations are marked as secrets if the key contains:

- `password`
- `secret`
- `key`
- `token`
- `credential`
- `auth`
- `private`
- `api_key`
- `apikey`

### Required Configuration Detection

Configurations are marked as required if the key contains:

- `database`
- `redis`
- `server`
- `port`
- `mongodb`
- `connection`
- `uri`
- `url`

## Validation Rules

### Schema Validation

- Database URIs must be valid MongoDB connection strings
- Server URLs must be valid HTTP/HTTPS URLs
- Ethereum addresses must match the correct format
- Private keys must be 64-character hex strings
- Ports must be valid port numbers (1-65535)

### Security Validation

- Secret values should be sufficiently long
- No test/demo values in production secrets
- HTTPS should be used for external URLs
- Private keys should not be exposed in logs

### Performance Validation

- Configuration values should not be excessively large
- Arrays should not contain too many items
- Complex objects should be reasonably sized

## Error Handling

### Migration Errors

- **AWS Access Errors** - Check AWS credentials and permissions
- **MongoDB Connection Errors** - Verify MongoDB connectivity
- **Schema Validation Errors** - Fix configuration format issues
- **Duplicate Key Errors** - Use `--overwrite` flag or resolve conflicts

### Validation Errors

- **Missing Required Configurations** - Add missing configurations
- **Type Mismatch Errors** - Fix configuration types
- **Schema Violations** - Update configurations to match expected schema
- **Security Issues** - Address security warnings

## Best Practices

### Before Migration

1. **Backup existing configurations** in MongoDB (if any)
2. **Document current AWS setup** for reference
3. **Test migration in development** environment first
4. **Plan rollback strategy** in case of issues

### During Migration

1. **Use dry-run mode** to preview changes
2. **Monitor logs** for errors and warnings
3. **Validate incrementally** rather than migrating everything at once
4. **Keep AWS configurations** as backup during transition

### After Migration

1. **Validate all configurations** using validation service
2. **Test application thoroughly** with new configuration source
3. **Monitor application performance** and behavior
4. **Update documentation** and deployment procedures
5. **Clean up AWS resources** only after confirming stability

## Troubleshooting

### Common Issues

#### Migration Fails with AWS Access Error

```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify secret access
aws secretsmanager get-secret-value --secret-id <secret-id>
```

#### MongoDB Connection Issues

```bash
# Test MongoDB connection
mongosh "mongodb://localhost:27017/eco-solver"

# Check MongoDB service status
systemctl status mongod
```

#### Configuration Validation Errors

```bash
# Run validation to see specific errors
npm run migrate-config validate

# Check application logs for configuration issues
npm run start:dev
```

#### Application Won't Start After Migration

1. Check configuration validation results
2. Verify all required configurations are present
3. Compare with original AWS configurations
4. Consider rollback if issues persist

### Getting Help

1. **Check logs** for detailed error messages
2. **Run validation** to identify specific issues
3. **Use dry-run mode** to test changes safely
4. **Compare configurations** between AWS and MongoDB
5. **Consult documentation** for configuration requirements

## Security Considerations

### Sensitive Data Handling

- Secret configurations are automatically detected and marked
- Sensitive values are masked in logs and audit trails
- Migration logs exclude actual secret values
- Rollback operations handle secrets securely

### Access Control

- Migration requires appropriate database permissions
- AWS access needs Secrets Manager read permissions
- Audit logs track all migration activities
- User context is preserved for accountability

### Data Protection

- Configurations are validated before storage
- Input sanitization prevents injection attacks
- Schema validation ensures data integrity
- Backup and rollback capabilities protect against data loss
