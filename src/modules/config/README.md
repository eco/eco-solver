# Configuration Module

This module provides a type-safe, schema-driven configuration system for the blockchain intent solver application. It uses Zod for validation and supports multiple configuration sources including environment variables and AWS Secrets Manager.

## Table of Contents

- [Overview](#overview)
- [Configuration Schema](#configuration-schema)
- [Environment Variables](#environment-variables)
- [AWS Secrets Manager](#aws-secrets-manager)
- [Configuration Services](#configuration-services)
- [Adding New Configuration](#adding-new-configuration)
- [Examples](#examples)

## Overview

The configuration system features:
- 🔒 **Type Safety**: Full TypeScript support with types inferred from Zod schema
- ✅ **Validation**: Runtime validation of all configuration values
- 🔄 **Dynamic Mapping**: Automatic environment variable name generation from schema
- ☁️ **AWS Integration**: Optional AWS Secrets Manager support
- 🔀 **Deep Merging**: Configuration sources are intelligently merged
- 📦 **Modular**: Each module has its own typed configuration service

## Configuration Schema

The main configuration schema is defined in `/src/config/config.schema.ts` using Zod:

```typescript
export const ConfigSchema = z.object({
  env: z.enum(['development', 'production', 'test']).default('development'),
  port: z.number().int().positive().default(3000),
  
  mongodb: z.object({
    uri: z.string().url().or(z.string().regex(/^mongodb:/)),
  }),
  
  // ... other configuration sections
});
```

## Environment Variables

### Naming Convention

Environment variable names are automatically derived from the schema structure:

| Schema Path | Environment Variable | Example Value |
|------------|---------------------|---------------|
| `port` | `PORT` | `3000` |
| `mongodb.uri` | `MONGODB_URI` | `mongodb://localhost:27017/db` |
| `redis.host` | `REDIS_HOST` | `localhost` |
| `redis.port` | `REDIS_PORT` | `6379` |
| `evm.chainId` | `EVM_CHAIN_ID` | `1` |
| `evm.rpcUrl` | `EVM_RPC_URL` | `https://eth-mainnet.g.alchemy.com/v2/key` |
| `evm.intentSourceAddress` | `EVM_INTENT_SOURCE_ADDRESS` | `0x1234...` |
| `queue.retryAttempts` | `QUEUE_RETRY_ATTEMPTS` | `3` |
| `aws.useAwsSecrets` | `USE_AWS_SECRETS` | `true` |

### Rules for Variable Name Generation

1. **Nested Properties**: Use underscores to separate path segments
   - `redis.options.timeout` → `REDIS_OPTIONS_TIMEOUT`

2. **CamelCase Conversion**: Convert camelCase to SNAKE_CASE
   - `chainId` → `CHAIN_ID`
   - `rpcUrl` → `RPC_URL`
   - `intentSourceAddress` → `INTENT_SOURCE_ADDRESS`

3. **Arrays**: Use numeric indices
   - `servers[0].host` → `SERVERS_0_HOST`
   - `evm.networks[10].rpcUrls[0]` → `EVM_NETWORKS_10_RPC_URLS_0`

4. **Records (Dynamic Keys)**: Numeric segments in records are treated as object keys
   - `chainConfig["8453"].rpcUrl` → `CHAIN_CONFIG_8453_RPC_URL`
   - `services["api-v2"].endpoint` → `SERVICES_API_V2_ENDPOINT`

5. **Special Patterns**: The transformer recognizes common multi-word patterns
   - `chainConfig` → `CHAIN_CONFIG` (not `CHAIN_CONFIG`)
   - `rpcUrl` → `RPC_URL` (not `RPC_URL`)
   - `wsUrl` → `WS_URL` (not `WS_URL`)
   - `privateKey` → `PRIVATE_KEY` (not `PRIVATE_KEY`)
   - `secretAccessKey` → `SECRET_ACCESS_KEY` (not `SECRET_ACCESS_KEY`)

### Array vs Object Key Disambiguation

When dealing with numeric segments in environment variable names, the transformer uses the Zod schema to determine whether to treat them as array indices or object keys:

- **Arrays** (`z.array()`): Numeric segments are treated as array indices
  - Example: `DATABASE_CONNECTIONS_0_URL` → `database.connections[0].url`
  - The schema defines `connections` as an array, so `0` is an array index
  
- **Records** (`z.record()`): Numeric segments are treated as object keys
  - Example: `CHAIN_CONFIG_8453_RPC_URL` → `chainConfig["8453"].rpcUrl`
  - The schema defines `chainConfig` as a record, so `8453` is an object key

This automatic disambiguation allows you to configure both indexed arrays and keyed objects using environment variables without ambiguity.

### Type Conversions

The system automatically converts string environment variables to the correct types:

- **Numbers**: `"3000"` → `3000`
- **Booleans**: `"true"` → `true`, `"false"` → `false`
- **Arrays**: `"item1,item2,item3"` → `["item1", "item2", "item3"]`
- **Objects**: `'{"key":"value"}'` → `{key: "value"}`

## AWS Secrets Manager

### Setup

1. **Enable AWS Secrets Manager**:
   ```bash
   USE_AWS_SECRETS=true
   AWS_REGION=us-east-1
   AWS_SECRET_NAME=blockchain-intent-solver-secrets
   ```

2. **Authentication** (choose one):
   - IAM Role (recommended for EC2/ECS/Lambda)
   - Environment variables:
     ```bash
     AWS_ACCESS_KEY_ID=your-access-key
     AWS_SECRET_ACCESS_KEY=your-secret-key
     ```

3. **Secret Format** in AWS:
   ```json
   {
     "MONGODB_URI": "mongodb://prod-server:27017/prod-db",
     "REDIS_PASSWORD": "strong-password",
     "EVM_PRIVATE_KEY": "0x...",
     "EVM_RPC_URL": "https://eth-mainnet.g.alchemy.com/v2/prod-key",
     "SOLANA_SECRET_KEY": "[...]"
   }
   ```

### How It Works

1. Local environment variables are loaded first
2. If `USE_AWS_SECRETS=true`, secrets are fetched from AWS
3. AWS secrets are deep merged with local config (AWS takes precedence)
4. Final configuration is validated against the Zod schema

### Example Merge Behavior

**Local .env**:
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```

**AWS Secrets**:
```json
{
  "REDIS_PASSWORD": "secret123",
  "REDIS_PORT": "6380"
}
```

**Result**:
```javascript
{
  redis: {
    host: 'localhost',      // from local env
    port: 6380,            // from AWS (overrides local)
    password: 'secret123'  // from AWS
  }
}
```

## Configuration Services

Each module has its own typed configuration service:

### Available Services

- `AppConfigService` - Application-level config (port, environment)
- `DatabaseConfigService` - MongoDB configuration
- `RedisConfigService` - Redis configuration
- `EvmConfigService` - EVM blockchain configuration
- `SolanaConfigService` - Solana blockchain configuration
- `QueueConfigService` - BullMQ queue configuration
- `AwsConfigService` - AWS configuration

### Usage Example

```typescript
import { Injectable } from '@nestjs/common';
import { EvmConfigService } from '@/modules/config/services';

@Injectable()
export class MyService {
  constructor(private evmConfig: EvmConfigService) {}

  async connectToBlockchain() {
    const rpcUrl = this.evmConfig.rpcUrl;
    const chainId = this.evmConfig.chainId;
    // ... use configuration
  }
}
```

## Adding New Configuration

### 1. Update the Schema

Edit `/src/config/config.schema.ts`:

```typescript
export const ConfigSchema = z.object({
  // ... existing config ...
  
  myNewFeature: z.object({
    apiKey: z.string(),
    endpoint: z.string().url(),
    retryConfig: z.object({
      maxAttempts: z.number().int().min(1).default(3),
      delayMs: z.number().int().min(0).default(1000),
    }),
    enabledRegions: z.array(z.string()).optional(),
  }),
});
```

### 2. Create a Configuration Service

Create `/src/modules/config/services/my-new-feature-config.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MyNewFeatureConfigService {
  constructor(private configService: ConfigService) {}

  get apiKey(): string {
    return this.configService.get<string>('myNewFeature.apiKey');
  }

  get endpoint(): string {
    return this.configService.get<string>('myNewFeature.endpoint');
  }

  get maxRetryAttempts(): number {
    return this.configService.get<number>('myNewFeature.retryConfig.maxAttempts');
  }

  get retryDelayMs(): number {
    return this.configService.get<number>('myNewFeature.retryConfig.delayMs');
  }

  get enabledRegions(): string[] | undefined {
    return this.configService.get<string[]>('myNewFeature.enabledRegions');
  }
}
```

### 3. Export and Register

Add to `/src/modules/config/services/index.ts`:
```typescript
export * from './my-new-feature-config.service';
```

Add to `/src/modules/config/config.module.ts`:
```typescript
const configProviders = [
  // ... existing providers ...
  MyNewFeatureConfigService,
];
```

### 4. Use Environment Variables

The following environment variables are now automatically supported:
```bash
MY_NEW_FEATURE_API_KEY=abc123
MY_NEW_FEATURE_ENDPOINT=https://api.example.com
MY_NEW_FEATURE_RETRY_CONFIG_MAX_ATTEMPTS=5
MY_NEW_FEATURE_RETRY_CONFIG_DELAY_MS=2000
MY_NEW_FEATURE_ENABLED_REGIONS_0=us-east-1
MY_NEW_FEATURE_ENABLED_REGIONS_1=eu-west-1
```

## Examples

### Basic Configuration

```bash
# .env file
NODE_ENV=production
PORT=3000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/intent-solver

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# EVM Configuration
EVM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-key
EVM_CHAIN_ID=1
EVM_PRIVATE_KEY=0x...
EVM_INTENT_SOURCE_ADDRESS=0x...
EVM_INBOX_ADDRESS=0x...
```

### Production with AWS Secrets

```bash
# .env file (minimal)
NODE_ENV=production
USE_AWS_SECRETS=true
AWS_REGION=us-east-1
AWS_SECRET_NAME=prod-intent-solver-secrets

# Non-sensitive defaults
REDIS_HOST=redis
EVM_CHAIN_ID=1
```

AWS Secret:
```json
{
  "MONGODB_URI": "mongodb://prod-cluster:27017/intent-solver?ssl=true",
  "REDIS_PASSWORD": "strong-redis-password",
  "EVM_PRIVATE_KEY": "0x...",
  "EVM_RPC_URL": "https://eth-mainnet.g.alchemy.com/v2/prod-key",
  "SOLANA_SECRET_KEY": "[...]"
}
```

### Complex Nested Configuration

#### Arrays Example

For a configuration with arrays:

```typescript
// Schema
const ConfigSchema = z.object({
  services: z.object({
    api: z.object({
      endpoints: z.array(z.object({
        url: z.string().url(),
        priority: z.number(),
      })),
    }),
  }),
});
```

Environment variables:
```bash
SERVICES_API_ENDPOINTS_0_URL=https://api1.example.com
SERVICES_API_ENDPOINTS_0_PRIORITY=1
SERVICES_API_ENDPOINTS_1_URL=https://api2.example.com
SERVICES_API_ENDPOINTS_1_PRIORITY=2
```

#### Records Example

For dynamic chain configurations using records:

```typescript
// Schema
const ConfigSchema = z.object({
  chainConfig: z.record(z.string(), z.object({
    rpcUrl: z.string().url(),
    wsUrl: z.string().url().optional(),
    explorer: z.string().url().optional(),
  })),
});
```

Environment variables:
```bash
# Ethereum mainnet (chain ID 1)
CHAIN_CONFIG_1_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/key
CHAIN_CONFIG_1_WS_URL=wss://eth-mainnet.g.alchemy.com/v2/key
CHAIN_CONFIG_1_EXPLORER=https://etherscan.io

# Base (chain ID 8453)
CHAIN_CONFIG_8453_RPC_URL=https://base-mainnet.g.alchemy.com/v2/key
CHAIN_CONFIG_8453_WS_URL=wss://base-mainnet.g.alchemy.com/v2/key
CHAIN_CONFIG_8453_EXPLORER=https://basescan.org

# Polygon (chain ID 137)
CHAIN_CONFIG_137_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/key
CHAIN_CONFIG_137_EXPLORER=https://polygonscan.com
```

This creates:
```javascript
{
  chainConfig: {
    "1": {
      rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/key",
      wsUrl: "wss://eth-mainnet.g.alchemy.com/v2/key",
      explorer: "https://etherscan.io"
    },
    "8453": {
      rpcUrl: "https://base-mainnet.g.alchemy.com/v2/key",
      wsUrl: "wss://base-mainnet.g.alchemy.com/v2/key",
      explorer: "https://basescan.org"
    },
    "137": {
      rpcUrl: "https://polygon-mainnet.g.alchemy.com/v2/key",
      explorer: "https://polygonscan.com"
    }
  }
}
```

## Troubleshooting

### Configuration Validation Errors

If you see validation errors on startup:
```
Configuration validation error: evm.privateKey: Invalid
```

Check that:
1. The environment variable is set: `EVM_PRIVATE_KEY`
2. The value matches the schema validation (e.g., correct format for private key)
3. AWS Secrets Manager is accessible if `USE_AWS_SECRETS=true`

### Missing Configuration

If a configuration value is `undefined`:
1. Check the environment variable name matches the schema path
2. Verify the schema includes the property
3. Check if AWS Secrets Manager is overriding the value
4. Enable debug logging to see configuration loading process

### AWS Secrets Manager Issues

Common issues:
- **Access Denied**: Check IAM permissions for `secretsmanager:GetSecretValue`
- **Secret Not Found**: Verify `AWS_SECRET_NAME` matches the secret name in AWS
- **Region Mismatch**: Ensure `AWS_REGION` is correct
- **Invalid JSON**: Check that the secret value is valid JSON

## Best Practices

1. **Use Configuration Services**: Always inject typed configuration services instead of `ConfigService`
2. **Validate Early**: The schema validation runs at startup, catching issues early
3. **Keep Secrets Secure**: Never commit sensitive values to version control
4. **Document Defaults**: Use Zod's `.default()` for sensible defaults
5. **Group Related Config**: Organize configuration into logical sections
6. **Use AWS for Production**: Store production secrets in AWS Secrets Manager
7. **Type Everything**: Let TypeScript and Zod handle type safety

## Further Reading

- [Zod Documentation](https://zod.dev/)
- [NestJS Configuration](https://docs.nestjs.com/techniques/configuration)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [Project CLAUDE.md](../../../../../../CLAUDE.md) - Project-specific guidelines