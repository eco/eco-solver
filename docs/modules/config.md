# Config Module

## Overview

The Config module provides a centralized, type-safe configuration management system using Zod schemas for validation and NestJS's `registerAs` pattern for modular configuration. It supports automatic environment variable mapping, AWS Secrets Manager integration, and provides typed configuration services for each domain.

## Architecture

### Schema-Driven Configuration

The configuration system is built on three core principles:

1. **Zod Schemas**: Define structure, validation rules, and defaults
2. **Type Inference**: TypeScript types automatically derived from schemas
3. **Environment Mapping**: Automatic conversion between nested config and env vars

### Configuration Flow

```
Environment Variables
        ↓
AWS Secrets Manager (optional)
        ↓
    Deep Merge
        ↓
  Zod Validation
        ↓
Typed Config Services
        ↓
  Module Injection
```

## Configuration Services

Each domain has its own typed configuration service:

### AppConfigService
General application settings.

```typescript
interface AppConfig {
  env: 'development' | 'staging' | 'production';
  port: number;
  cors: {
    enabled: boolean;
    origins: string[];
  };
  rateLimit: {
    enabled: boolean;
    ttl: number;
    limit: number;
  };
}
```

### DatabaseConfigService
MongoDB connection settings.

```typescript
interface DatabaseConfig {
  mongodb: {
    uri: string;
    options: {
      retryWrites: boolean;
      w: string;
      appName: string;
    };
  };
}
```

### RedisConfigService
Redis connection for queues and caching.

```typescript
interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  maxRetriesPerRequest: number;
}
```

### EvmConfigService
EVM blockchain configuration.

```typescript
interface EvmConfig {
  privateKey?: string;
  networks: Array<{
    chainId: bigint;
    rpcUrls: string[];
    intentSourceAddress: string;
    inboxAddress: string;
    startBlock?: bigint;
    confirmations: number;
    feeLogic: {
      baseFlatFee: bigint;
      scalarBps: bigint;
    };
  }>;
  wallets: {
    basic?: {
      privateKey?: string;
    };
    kernel?: {
      signerType: 'eoa' | 'kms';
      signerPrivateKey?: string;
      signerRegion?: string;
      signerKeyId?: string;
    };
  };
}
```

### SolanaConfigService
Solana blockchain configuration.

```typescript
interface SolanaConfig {
  rpcUrl: string;
  commitment: 'processed' | 'confirmed' | 'finalized';
  programId: string;
  secretKey: number[];
  startSlot?: number;
}
```

### TvmConfigService
Tron blockchain configuration.

```typescript
interface TvmConfig {
  network: string;
  rpcUrl: string;
  apiKey?: string;
  privateKey: string;
  contractAddress: string;
  energyLimit: number;
  startBlock?: number;
}
```

### FulfillmentConfigService
Strategy and validation configuration.

```typescript
interface FulfillmentConfig {
  defaultStrategy: string;
  strategies: {
    [key: string]: {
      enabled: boolean;
    };
  };
  validations: {
    routeLimits: {
      default: bigint;
      routes: Array<{
        chainId: bigint;
        limit: bigint;
      }>;
    };
    fees: {
      standard: {
        baseFee: bigint;
        percentageFee: number;
      };
      crowdLiquidity: {
        baseFee: bigint;
        percentageFee: number;
      };
      native: {
        baseFee: bigint;
        percentageFee: number;
      };
    };
  };
}
```

### ProverConfigService
Prover configuration for route validation.

```typescript
interface ProverConfig {
  provers: Array<{
    type: ProverTypeName;
    chainConfigs: Array<{
      chainId: bigint;
      contractAddress: string;
    }>;
  }>;
}
```

### QueueConfigService
Queue and worker settings.

```typescript
interface QueueConfig {
  concurrency: {
    fulfillment: number;
    execution: number;
  };
  retry: {
    attempts: number;
    backoff: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
  };
}
```

### TokenConfigService
Token configurations across chains.

```typescript
interface TokenConfig {
  tokens: Array<{
    symbol: string;
    name: string;
    chains: Array<{
      chainId: bigint;
      address: UniversalAddress;
      decimals: number;
    }>;
  }>;
}
```

## Environment Variable Mapping

The system automatically maps between nested configuration and flat environment variables:

### Mapping Rules

1. **Nested Paths**: Convert dots to underscores
   - `mongodb.uri` → `MONGODB_URI`

2. **CamelCase**: Convert to SCREAMING_SNAKE_CASE
   - `rpcUrl` → `RPC_URL`

3. **Arrays**: Use numeric indices
   - `networks[0].chainId` → `NETWORKS_0_CHAIN_ID`
   - `networks[1].rpcUrls[0]` → `NETWORKS_1_RPC_URLS_0`

4. **BigInt Values**: Automatically converted from strings
   - `"1000000000000000000"` → `1000000000000000000n`

### Examples

```bash
# Simple values
NODE_ENV=production
PORT=3000

# Nested objects
MONGODB_URI=mongodb://localhost:27017/solver

# Arrays
EVM_NETWORKS_0_CHAIN_ID=1
EVM_NETWORKS_0_RPC_URLS_0=https://eth.example.com
EVM_NETWORKS_0_INTENT_SOURCE_ADDRESS=0x123...

EVM_NETWORKS_1_CHAIN_ID=10
EVM_NETWORKS_1_RPC_URLS_0=https://optimism.example.com
EVM_NETWORKS_1_INTENT_SOURCE_ADDRESS=0x456...

# Complex nested
FULFILLMENT_VALIDATIONS_ROUTE_LIMITS_ROUTES_0_CHAIN_ID=1
FULFILLMENT_VALIDATIONS_ROUTE_LIMITS_ROUTES_0_LIMIT=10000000000000000000
```

## AWS Secrets Manager Integration

### Configuration
```bash
AWS_REGION=us-east-1
AWS_SECRET_NAME=blockchain-intent-solver-secrets
AWS_ACCESS_KEY_ID=AKIA...  # Optional with IAM roles
AWS_SECRET_ACCESS_KEY=...   # Optional with IAM roles
```

### Secret Format
Store secrets as JSON in AWS Secrets Manager:
```json
{
  "evm": {
    "privateKey": "0x...",
    "wallets": {
      "kernel": {
        "signerPrivateKey": "0x..."
      }
    }
  },
  "solana": {
    "secretKey": [1, 2, 3, ...]
  }
}
```

### Integration Flow
1. Secrets fetched on application startup
2. Deep merged with environment variables
3. AWS secrets take precedence
4. Validated through Zod schemas

## Schema Definition

### Creating a Schema

```typescript
// src/config/schemas/myservice.schema.ts
import { z } from 'zod';
import { registerAs } from '@nestjs/config';

// Define the Zod schema
export const MyServiceSchema = z.object({
  apiUrl: z.string().url().default('https://api.example.com'),
  timeout: z.number().min(1000).default(5000),
  retries: z.number().min(0).max(10).default(3),
  features: z.object({
    caching: z.boolean().default(true),
    logging: z.boolean().default(false),
  }),
});

// Infer TypeScript type
export type MyServiceConfig = z.infer<typeof MyServiceSchema>;

// Create registerAs factory
export const myServiceConfig = registerAs('myService', () => {
  const config = {
    apiUrl: process.env.MY_SERVICE_API_URL,
    timeout: parseInt(process.env.MY_SERVICE_TIMEOUT || '5000'),
    retries: parseInt(process.env.MY_SERVICE_RETRIES || '3'),
    features: {
      caching: process.env.MY_SERVICE_FEATURES_CACHING === 'true',
      logging: process.env.MY_SERVICE_FEATURES_LOGGING === 'true',
    },
  };
  
  return MyServiceSchema.parse(config);
});
```

### Creating a Config Service

```typescript
// src/modules/config/services/myservice-config.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MyServiceConfig } from '@/config/schemas/myservice.schema';

@Injectable()
export class MyServiceConfigService {
  private readonly config: MyServiceConfig;

  constructor(private configService: ConfigService) {
    this.config = this.configService.get<MyServiceConfig>('myService')!;
  }

  get apiUrl(): string {
    return this.config.apiUrl;
  }

  get timeout(): number {
    return this.config.timeout;
  }

  get retries(): number {
    return this.config.retries;
  }

  get isCachingEnabled(): boolean {
    return this.config.features.caching;
  }

  get isLoggingEnabled(): boolean {
    return this.config.features.logging;
  }
}
```

## Usage in Modules

### Injecting Config Services

```typescript
@Injectable()
export class MyService {
  constructor(
    private readonly configService: MyServiceConfigService,
    private readonly evmConfig: EvmConfigService,
  ) {}

  async makeRequest() {
    const url = this.configService.apiUrl;
    const timeout = this.configService.timeout;
    
    // Use configuration
    const response = await fetch(url, { 
      signal: AbortSignal.timeout(timeout) 
    });
    
    return response.json();
  }

  getNetworkConfig(chainId: bigint) {
    return this.evmConfig.getNetworkConfig(chainId);
  }
}
```

## Validation Features

### Zod Validation Capabilities

1. **Type Validation**
   ```typescript
   z.string()
   z.number()
   z.bigint()
   z.boolean()
   z.array()
   z.object()
   ```

2. **Constraints**
   ```typescript
   z.string().min(1).max(100)
   z.number().positive().int()
   z.array().min(1).max(10)
   ```

3. **Transformations**
   ```typescript
   z.string().transform(val => BigInt(val))
   z.string().transform(val => val.toLowerCase())
   ```

4. **Custom Validation**
   ```typescript
   z.string().refine(
     val => isAddress(val),
     'Invalid Ethereum address'
   )
   ```

5. **Default Values**
   ```typescript
   z.string().default('default-value')
   z.number().optional().default(100)
   ```

## Best Practices

### Schema Design
- Define defaults in schemas, not code
- Use appropriate validation constraints
- Add custom refinements for business logic
- Document complex validations

### Configuration Services
- Create a service for each domain
- Provide typed getters for all config
- Avoid exposing raw config objects
- Add helper methods for common operations

### Environment Variables
- Use descriptive names
- Follow naming conventions
- Document all variables
- Provide sensible defaults

### Security
- Never commit sensitive values
- Use AWS Secrets Manager for production
- Validate all external input
- Mask sensitive data in logs

## Troubleshooting

### Common Issues

1. **Validation Errors**
   ```
   ZodError: Invalid configuration
   ```
   - Check environment variables
   - Review schema requirements
   - Verify data types
   - Check for missing required fields

2. **AWS Secrets Not Loading**
   - Verify AWS credentials
   - Check secret name
   - Ensure proper IAM permissions
   - Review AWS region

3. **BigInt Parsing**
   - Ensure values are strings in env
   - Check for numeric overflow
   - Verify transformation logic

4. **Array Configuration**
   - Use correct index format (0-based)
   - Ensure sequential indices
   - Check underscore separators

### Debugging

Enable configuration debugging:
```typescript
// Log parsed configuration
console.log(JSON.stringify(config, null, 2));

// Log validation errors
try {
  schema.parse(config);
} catch (error) {
  if (error instanceof ZodError) {
    console.error(error.format());
  }
}
```

### Validation Error Format
```json
{
  "_errors": [],
  "mongodb": {
    "_errors": [],
    "uri": {
      "_errors": ["Invalid URL"]
    }
  },
  "networks": {
    "0": {
      "_errors": [],
      "chainId": {
        "_errors": ["Expected bigint, received string"]
      }
    }
  }
}
```