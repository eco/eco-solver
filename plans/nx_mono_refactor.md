# Nx-Optimized Monorepo Strategy for eco-solver

## Current State Analysis

The workspace is currently a **single NestJS application** with:

- **One project**: `eco-solver` (root-level app)
- **Minimal Nx integration**: Only ESLint and Jest plugins installed
- **NestJS-based**: Uses `@nestjs/schematics` for code generation
- **Basic caching**: Applied to build, test, lint operations
- **No project boundaries**: All code lives in single `src/` directory

## Nx-Enhanced Monorepo Proposal

Based on the current Nx configuration and available plugins, here's the refined strategy:

### Recommended Nx Plugin Stack

```bash
# Core backend infrastructure plugins
nx add @nx/nest        # NestJS applications & libraries
nx add @nx/node        # Node.js utilities & executors
nx add @nx/js          # JavaScript/TypeScript support
nx add @nx/workspace   # Workspace utilities

# Optional development plugins (as needed)
nx add @nx/webpack     # Custom bundling if needed for specific services
```

### Refined Project Structure

```
apps/
├── api-gateway/              # NestJS app - External API & routing
│   ├── src/
│   │   ├── controllers/      # REST endpoints
│   │   ├── guards/           # Authentication & authorization
│   │   ├── middleware/       # Request processing
│   │   └── main.ts          # Bootstrap
│   ├── project.json         # Nx project configuration
│   └── jest.config.ts       # App-specific tests
│
├── intent-engine/            # NestJS app - Core intent processing
│   ├── src/
│   │   ├── domain/          # Business entities & logic
│   │   ├── application/     # Use cases & handlers
│   │   ├── infrastructure/  # External integrations
│   │   └── main.ts
│   └── project.json
│
├── liquidity-orchestrator/   # NestJS app - Cross-chain operations
│   ├── src/
│   │   ├── providers/       # CCTP, Hyperlane, LiFi
│   │   ├── strategies/      # Rebalancing algorithms
│   │   ├── schedulers/      # Cron jobs
│   │   └── main.ts
│   └── project.json
│
├── chain-indexer/            # NestJS app - Blockchain monitoring
│   ├── src/
│   │   ├── listeners/       # Event watchers
│   │   ├── processors/      # Block/transaction processing
│   │   ├── synchronizers/   # State sync logic
│   │   └── main.ts
│   └── project.json
│
├── solver-registry/          # NestJS app - Solver management
│   ├── src/
│   │   ├── registration/    # Solver onboarding
│   │   ├── capabilities/    # Capability matching
│   │   ├── validation/      # Solver verification
│   │   └── main.ts
│   └── project.json
│
└── cli-tools/               # Node.js app - Administrative utilities
    ├── src/
    │   ├── commands/        # CLI command implementations
    │   ├── utils/          # CLI-specific utilities
    │   └── main.ts
    └── project.json

libs/
├── shared/                  # TypeScript library
│   ├── contracts/          # Smart contract types & ABIs
│   ├── types/              # Domain types & interfaces
│   ├── constants/          # System-wide constants
│   ├── utils/             # Pure functions
│   └── errors/            # Error definitions
│   └── project.json       # Buildable library
│
├── domain/                 # TypeScript library
│   ├── entities/          # Core business entities
│   ├── value-objects/     # Domain value objects
│   ├── repositories/      # Repository interfaces
│   └── services/          # Domain services
│   └── project.json
│
├── messaging/              # TypeScript library
│   ├── events/            # Domain & integration events
│   ├── commands/          # Command patterns
│   ├── queues/           # Queue management utilities
│   ├── publishers/        # Event publishing
│   └── subscribers/       # Event handling
│   └── project.json
│
├── database/               # TypeScript library
│   ├── schemas/           # Mongoose schemas
│   ├── repositories/      # Repository implementations
│   ├── migrations/        # Database migrations
│   └── connections/       # DB connection utilities
│   └── project.json
│
├── security/               # TypeScript library
│   ├── kms/              # AWS KMS integration
│   ├── signing/          # Transaction signing
│   ├── auth/             # Authentication utilities
│   └── encryption/       # Data encryption
│   └── project.json
│
└── integrations/           # TypeScript library
    ├── blockchain/        # Chain clients (Alchemy, etc.)
    ├── defi/             # DeFi protocols (LiFi, CCTP)
    ├── aws/              # AWS service clients
    └── external-apis/    # Third-party APIs
    └── project.json

tools/
├── eslint-rules/           # Custom ESLint rules for backend services
├── scripts/               # Build & deployment scripts
├── generators/            # Custom Nx generators for backend patterns
└── docker/                # Docker configurations for services
```

### Nx Configuration Enhancements

#### Enhanced `nx.json`

```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "defaultBase": "main",
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": ["default", "!{projectRoot}/**/?(*.)+(spec|test).[jt]s"],
    "sharedGlobals": []
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"],
      "cache": true
    },
    "test": {
      "inputs": ["default", "^production", "{workspaceRoot}/jest.preset.js"],
      "cache": true
    },
    "lint": {
      "inputs": ["default", "{workspaceRoot}/.eslintrc.json"],
      "cache": true
    },
    "serve": {
      "dependsOn": ["^build"]
    }
  },
  "plugins": [
    {
      "plugin": "@nx/nest/plugin",
      "options": {
        "buildTargetName": "build",
        "serveTargetName": "serve"
      }
    },
    {
      "plugin": "@nx/jest/plugin",
      "options": {
        "targetName": "test"
      }
    },
    {
      "plugin": "@nx/eslint/plugin",
      "options": {
        "targetName": "lint"
      }
    }
  ],
  "generators": {
    "@nx/nest": {
      "application": {
        "linter": "eslint",
        "unitTestRunner": "jest"
      }
    }
  }
}
```

#### Individual Project Configurations

**Example: `apps/intent-engine/project.json`**

```json
{
  "name": "intent-engine",
  "type": "application",
  "root": "apps/intent-engine",
  "sourceRoot": "apps/intent-engine/src",
  "targets": {
    "build": {
      "executor": "@nx/nest:build",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/apps/intent-engine"
      }
    },
    "serve": {
      "executor": "@nx/nest:serve",
      "options": {
        "buildTarget": "intent-engine:build"
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/apps/intent-engine"]
    },
    "docker-build": {
      "executor": "nx:run-commands",
      "options": {
        "command": "docker build -f apps/intent-engine/Dockerfile . -t intent-engine"
      }
    },
    "docker-run": {
      "executor": "nx:run-commands",
      "options": {
        "command": "docker run -p 3001:3000 intent-engine"
      }
    }
  },
  "tags": ["scope:backend", "type:application", "domain:intent"]
}
```

**Example: `libs/shared/project.json`**

```json
{
  "name": "shared",
  "type": "library",
  "root": "libs/shared",
  "sourceRoot": "libs/shared/src",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/shared",
        "main": "libs/shared/src/index.ts",
        "tsConfig": "libs/shared/tsconfig.lib.json"
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/libs/shared"]
    }
  },
  "tags": ["scope:shared", "type:library"]
}
```

### Nx-Specific Benefits & Features

#### 1. **Dependency Graph Management**

```bash
# Visualize project dependencies
nx graph

# See affected projects
nx show projects --affected

# Build only what changed
nx build --affected
```

#### 2. **Code Generation with NestJS Schematics**

```bash
# Generate new service in intent-engine
nx g @nestjs/schematics:service validation --project=intent-engine

# Generate new library
nx g @nx/nest:library pricing --directory=libs/domain

# Generate new application
nx g @nx/nest:application analytics-service
```

#### 3. **Advanced Task Orchestration**

```json
// In project.json
{
  "targets": {
    "serve-with-deps": {
      "executor": "nx:run-commands",
      "options": {
        "commands": ["nx build shared", "nx build domain", "nx serve intent-engine"],
        "parallel": false
      }
    }
  }
}
```

#### 4. **Module Boundary Enforcement**

```json
// .eslintrc.json
{
  "rules": {
    "@nx/enforce-module-boundaries": [
      "error",
      {
        "allow": [],
        "depConstraints": [
          {
            "sourceTag": "scope:shared",
            "onlyDependOnLibsWithTags": ["scope:shared"]
          },
          {
            "sourceTag": "type:application",
            "onlyDependOnLibsWithTags": ["type:library", "scope:shared"]
          },
          {
            "sourceTag": "domain:intent",
            "onlyDependOnLibsWithTags": ["domain:intent", "scope:shared", "type:utility"]
          }
        ]
      }
    ]
  }
}
```

### Migration Strategy Using Nx

#### Phase 1: Backend Foundation (Week 1)

```bash
# Add required plugins for NestJS backend
nx add @nx/nest @nx/node @nx/js

# Extract shared backend libraries first
nx g @nx/nest:library shared --directory=libs
nx g @nx/nest:library domain --directory=libs
nx g @nx/nest:library messaging --directory=libs
nx g @nx/nest:library database --directory=libs
nx g @nx/nest:library security --directory=libs
```

#### Phase 2: Backend Service Extraction (Weeks 2-3)

```bash
# Generate NestJS applications using Nx
nx g @nx/nest:application api-gateway --directory=apps
nx g @nx/nest:application intent-engine --directory=apps
nx g @nx/nest:application liquidity-orchestrator --directory=apps
nx g @nx/nest:application chain-indexer --directory=apps
nx g @nx/nest:application solver-registry --directory=apps

# Generate Node.js CLI application
nx g @nx/node:application cli-tools --directory=apps

# Move existing code with proper imports
# Nx will help track dependencies automatically
```

#### Phase 3: Backend Optimization & Script Migration (Week 4)

```bash
# Set up proper caching for backend services
nx reset  # Clear cache
nx build --all  # Populate cache

# Add module boundary rules for backend architecture
# Configure project tags and dependencies

# Set up CI optimizations for backend services
nx affected -t build --base=main --head=HEAD
nx affected -t test --base=main --head=HEAD

# Add Docker configurations for each service
# Set up environment-specific configurations

# Update root package.json with Nx-optimized scripts
# Configure individual project.json files for each service
```

### Redis Queue Integration with Nx

#### Enhanced Queue Configuration

```typescript
// libs/messaging/src/queues/queue.config.ts
import { registerAs } from '@nestjs/config'

export const queueConfig = registerAs('queue', () => ({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
  queues: {
    intent: { name: 'intent-processing' },
    liquidity: { name: 'liquidity-management' },
    chain: { name: 'chain-monitoring' },
    analytics: { name: 'analytics-collection' },
  },
}))
```

#### Nx-Generated Backend Queue Services

```bash
# Generate queue services using Nx for backend message handling
nx g @nestjs/schematics:service queue/intent --project=messaging
nx g @nestjs/schematics:service queue/liquidity --project=messaging
nx g @nestjs/schematics:provider queue/redis-connection --project=messaging
nx g @nestjs/schematics:processor queue/chain-events --project=messaging
```

### Key Advantages of Nx-Based Backend Approach

#### Development Experience

- **Fast builds**: Only rebuild affected backend services
- **Integrated tooling**: Single command for all NestJS operations
- **Code generation**: Consistent NestJS project structure via generators
- **Dependency tracking**: Automatic dependency graph management for backend services

#### Architectural Benefits

- **Module boundaries**: Enforced via ESLint rules for backend architecture
- **Shared code**: Reusable backend libraries with proper versioning
- **Independent deployment**: Each NestJS service can deploy separately
- **Scalable testing**: Run tests only for affected backend services

#### Backend-Specific Benefits

- **NestJS optimization**: Built-in support for NestJS applications and libraries
- **Microservices ready**: Each service can scale independently
- **Queue management**: Centralized Redis queue configuration across services
- **Security consistency**: Shared security libraries (KMS, signing, auth)
- **Database abstraction**: Unified database access patterns

#### Operational Excellence

- **CI optimization**: Build only changed backend services
- **Cache efficiency**: Shared computation cache for backend builds
- **Service insights**: Visual dependency graph for service architecture
- **Consistent tooling**: Standardized NestJS scripts and configurations
- **Docker integration**: Easy containerization for each backend service

This Nx-optimized approach leverages your existing NestJS expertise while providing the monorepo structure needed for backend service separation and Redis queue-based communication.

## Enhanced Package.json Configuration

### Current Script Analysis

**Current Issues with Scripts:**

- `"build": "nest build"` - Single application pattern, needs Nx build orchestration
- `"start": "NODE_OPTIONS='--max-old-space-size=4096' nest start"` - Missing project-specific targeting
- Service scripts assume monolithic structure - need project scoping
- No affected build capabilities for efficient CI/CD
- Missing dependency management between services and libraries

### Nx-Optimized Root Package.json Scripts

```json
{
  "name": "eco-solver-monorepo",
  "version": "1.5.0",
  "private": true,
  "workspaces": ["apps/*", "libs/*"],
  "scripts": {
    "preinstall": "npx only-allow pnpm",

    // Workspace-wide operations
    "build": "nx run-many -t build",
    "build:affected": "nx affected -t build",
    "build:all": "nx run-many -t build --all",
    "build:services": "nx run-many -t build --projects=tag:service",
    "build:libs": "nx run-many -t build --projects=tag:lib",

    // Testing strategies
    "test": "nx run-many -t test",
    "test:affected": "nx affected -t test",
    "test:watch": "nx run-many -t test --watch",
    "test:e2e": "nx run-many -t e2e",
    "test:coverage": "nx run-many -t test --coverage",

    // Code quality
    "lint": "nx run-many -t lint",
    "lint:affected": "nx affected -t lint",
    "lint:fix": "nx run-many -t lint --fix",
    "format": "nx run-many -t format",
    "format:check": "nx run-many -t format --check",

    // Service management
    "start:api-gateway": "nx serve api-gateway",
    "start:intent-engine": "nx serve intent-engine",
    "start:liquidity-orchestrator": "nx serve liquidity-orchestrator",
    "start:chain-indexer": "nx serve chain-indexer",
    "start:solver-registry": "nx serve solver-registry",
    "cli": "nx serve cli-tools",

    // Development workflows
    "dev": "nx run-many -t serve --parallel=6",
    "dev:affected": "nx affected -t serve --parallel",
    "setup": "pnpm install && nx run-many -t build --projects=tag:lib",
    "setup:db": "docker-compose up -d mongodb redis",

    // CI/CD optimized
    "ci:build": "nx affected -t build --base=origin/main",
    "ci:test": "nx affected -t test --base=origin/main --parallel=4",
    "ci:lint": "nx affected -t lint --base=origin/main",

    // Docker operations
    "docker:build": "nx run-many -t docker-build --parallel=3",
    "docker:services": "nx run-many -t docker-build --projects=tag:service",

    // Utilities
    "clean": "nx reset && rm -rf dist node_modules/.cache",
    "graph": "nx graph",
    "workspace:info": "nx report"
  }
}
```

### Individual Service Configuration Examples

#### API Gateway Service (apps/api-gateway/project.json)

```json
{
  "name": "api-gateway",
  "sourceRoot": "apps/api-gateway/src",
  "projectType": "application",
  "tags": ["scope:api", "type:service", "service"],
  "targets": {
    "build": {
      "executor": "@nx/nest:build",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/apps/api-gateway",
        "main": "apps/api-gateway/src/main.ts",
        "tsConfig": "apps/api-gateway/tsconfig.app.json"
      }
    },
    "serve": {
      "executor": "@nx/nest:serve",
      "defaultConfiguration": "development",
      "options": {
        "buildTarget": "api-gateway:build",
        "inspect": false,
        "runtimeArgs": ["--max-old-space-size=4096"]
      },
      "configurations": {
        "development": {
          "buildTarget": "api-gateway:build:development"
        },
        "production": {
          "buildTarget": "api-gateway:build:production"
        }
      }
    },
    "docker-build": {
      "executor": "nx:run-commands",
      "options": {
        "command": "docker build -f apps/api-gateway/Dockerfile . -t eco-solver/api-gateway:latest"
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/apps/api-gateway"],
      "options": {
        "jestConfig": "apps/api-gateway/jest.config.ts"
      }
    }
  }
}
```

#### Shared Library Configuration (libs/shared/project.json)

```json
{
  "name": "shared",
  "sourceRoot": "libs/shared/src",
  "projectType": "library",
  "tags": ["scope:shared", "type:lib", "lib"],
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/shared",
        "main": "libs/shared/src/index.ts",
        "tsConfig": "libs/shared/tsconfig.lib.json",
        "assets": ["libs/shared/*.md"]
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/libs/shared"],
      "options": {
        "jestConfig": "libs/shared/jest.config.ts"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": ["libs/shared/**/*.ts"]
      }
    }
  }
}
```

### Enhanced nx.json Configuration

```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "defaultBase": "main",
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
      "!{projectRoot}/tsconfig.spec.json",
      "!{projectRoot}/jest.config.[jt]s"
    ],
    "sharedGlobals": []
  },
  "targetDefaults": {
    "build": {
      "cache": true,
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"],
      "outputs": ["{projectRoot}/dist"]
    },
    "serve": {
      "cache": true,
      "dependsOn": ["^build"]
    },
    "test": {
      "cache": true,
      "inputs": ["default", "^production", "{workspaceRoot}/jest.preset.js"],
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"]
    },
    "lint": {
      "cache": true,
      "inputs": ["default", "{workspaceRoot}/.eslintrc.json"]
    },
    "docker-build": {
      "cache": true,
      "dependsOn": ["build"]
    }
  },
  "plugins": [
    {
      "plugin": "@nx/nest/plugin",
      "options": {
        "buildTargetName": "build",
        "serveTargetName": "serve",
        "testTargetName": "test",
        "lintTargetName": "lint"
      }
    },
    {
      "plugin": "@nx/jest/plugin",
      "options": {
        "targetName": "test"
      }
    },
    {
      "plugin": "@nx/eslint/plugin",
      "options": {
        "targetName": "lint"
      }
    }
  ],
  "generators": {
    "@nx/nest": {
      "application": {
        "linter": "eslint",
        "unitTestRunner": "jest"
      },
      "library": {
        "linter": "eslint",
        "unitTestRunner": "jest"
      }
    }
  }
}
```

### Script Migration Benefits

**Workspace Operations:**

- `nx run-many -t build` - Build all projects with dependency management
- `nx affected -t build` - Build only changed projects (efficient CI/CD)
- `nx run-many -t build --projects=tag:service` - Build only services

**Service Management:**

- `nx serve api-gateway` - Start specific service with proper dependency resolution
- `nx run-many -t serve --parallel=6` - Start all services in parallel

**Testing Optimization:**

- `nx affected -t test` - Test only affected projects
- `nx run-many -t test --parallel=4` - Parallel test execution

**Development Workflow:**

- Proper dependency tracking between services and libraries
- Intelligent caching across all operations
- Visual dependency graph with `nx graph`

## Architectural Analysis Summary

### Current Architecture Issues Addressed

**1. Monolithic Service Boundaries**

- All functionality currently lives in a single NestJS application (`/Users/stoyan/git/worktree/nx_mono/src/`)
- Services are tightly coupled through direct imports using `@/` path aliases
- Mixed responsibilities within single modules (e.g., liquidity-manager contains multiple provider implementations)

**2. Inconsistent Queue Architecture**

- Basic BullMQ implementation exists but lacks structured queue taxonomy
- Queue definitions show minimal organization
- No clear separation between command, event, and scheduled operations

**3. Database Coupling**

- Direct MongoDB access throughout services without proper abstraction
- Mixed data access patterns between repositories and direct service queries

### Service Consolidation & Boundaries

**Merged Services for Better Cohesion:**

- **intent-engine**: Combines intent processing + quote generation (high cohesion)
- **liquidity-orchestrator**: Unifies liquidity management + balance tracking (shared context)
- **chain-indexer**: Focused on blockchain data ingestion and event processing

**Benefits:**

- Reduces inter-service communication overhead
- Eliminates artificial boundaries between related functionality
- Maintains single responsibility at the business domain level

### Event-Driven Architecture

**Enhanced Messaging System:**

```typescript
// libs/messaging/events/domain.events.ts
export interface IntentCreatedEvent {
  intentId: string
  chainId: number
  creator: Address
  timestamp: Date
  metadata: IntentMetadata
}

export interface BalanceUpdatedEvent {
  walletAddress: Address
  chainId: number
  tokenAddress: Address
  previousBalance: bigint
  newBalance: bigint
  source: 'rpc' | 'transaction' | 'rebalance'
}
```

**Queue Architecture:**

```
messaging/queues/
├── commands/                   # Direct service operations
│   ├── intent.commands.ts     # CreateIntent, ValidateIntent, FulfillIntent
│   ├── liquidity.commands.ts  # Rebalance, UpdateBalance, TransferFunds
│   └── solver.commands.ts     # RegisterSolver, UpdateCapabilities
├── events/                     # Broadcast notifications
│   ├── domain.events.ts       # Business domain events
│   ├── integration.events.ts  # External system events
│   └── analytics.events.ts    # Metrics and tracking events
└── patterns/                   # Queue management utilities
    ├── retry.strategies.ts    # Exponential backoff, circuit breakers
    ├── dead-letter.handler.ts # Failed message handling
    └── batch.processor.ts     # Bulk operations support
```

### Domain-Driven Design Implementation

**Intent Management Domain (intent-engine):**

```typescript
// Domain structure within intent-engine
src/
├── domain/
│   ├── entities/
│   │   ├── intent.entity.ts           # Core intent aggregate
│   │   ├── quote.entity.ts            # Quote value object
│   │   └── fulfillment.entity.ts      # Fulfillment tracking
│   ├── services/
│   │   ├── intent-validation.service.ts
│   │   ├── quote-generation.service.ts
│   │   └── fulfillment-coordination.service.ts
│   └── repositories/
│       ├── intent.repository.interface.ts
│       └── quote.repository.interface.ts
├── application/
│   ├── handlers/
│   │   ├── create-intent.handler.ts
│   │   ├── validate-intent.handler.ts
│   │   └── fulfill-intent.handler.ts
│   └── queries/
│       ├── get-intent.query.ts
│       └── list-intents.query.ts
└── infrastructure/
    ├── repositories/
    │   ├── mongo-intent.repository.ts
    │   └── redis-quote-cache.repository.ts
    └── external/
        ├── permit-validation.client.ts
        └── prover.client.ts
```

**Liquidity Management Domain (liquidity-orchestrator):**

```typescript
// Domain structure within liquidity-orchestrator
src/
├── domain/
│   ├── entities/
│   │   ├── balance.entity.ts          # Multi-chain balance aggregate
│   │   ├── rebalance-strategy.entity.ts
│   │   └── liquidity-position.entity.ts
│   ├── services/
│   │   ├── rebalance-optimizer.service.ts
│   │   ├── balance-monitor.service.ts
│   │   └── provider-selector.service.ts
│   └── providers/                     # Provider interfaces
│       ├── cctp.provider.interface.ts
│       ├── hyperlane.provider.interface.ts
│       └── lifi.provider.interface.ts
├── application/
│   ├── handlers/
│   │   ├── rebalance.handler.ts
│   │   ├── update-balance.handler.ts
│   │   └── execute-transfer.handler.ts
│   └── schedulers/
│       ├── balance-check.scheduler.ts
│       └── rebalance-cron.scheduler.ts
└── infrastructure/
    ├── providers/                     # Provider implementations
    │   ├── cctp-lifi.provider.ts
    │   ├── hyperlane.provider.ts
    │   └── relay.provider.ts
    └── repositories/
        ├── mongo-balance.repository.ts
        └── redis-rebalance-cache.repository.ts
```

### Enhanced Shared Libraries

**Database Abstraction Layer:**

```typescript
// libs/database/repositories/base.repository.ts
export abstract class BaseRepository<T> {
  abstract findById(id: string): Promise<T | null>
  abstract save(entity: T): Promise<T>
  abstract delete(id: string): Promise<void>
  abstract findBy(criteria: Partial<T>): Promise<T[]>
}

// libs/database/entities/intent.entity.ts
export class Intent {
  constructor(
    public readonly id: IntentId,
    public readonly creator: Address,
    public readonly source: ChainConfig,
    public readonly destination: ChainConfig,
    public status: IntentStatus,
    public readonly createdAt: Date,
  ) {}

  canBeFulfilled(): boolean {
    /* business logic */
  }
  markAsFulfilled(txHash: string): void {
    /* state transition */
  }
}
```

**Security Layer Enhancement:**

```typescript
// libs/security/signing/transaction-signer.ts
export interface TransactionSigner {
  signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction>
  signTypedData(data: TypedData): Promise<Signature>
  getAddress(): Promise<Address>
}

// libs/security/auth/service-auth.ts
export class ServiceAuthenticator {
  verifyServiceToken(token: string): Promise<ServiceIdentity>
  generateServiceToken(serviceId: string): Promise<string>
}
```

## Next Steps & Validation Questions

1. **Domain Alignment**: Do the merged services (intent-engine, liquidity-orchestrator) align with your team ownership model?

2. **Migration Complexity**: Is the 4-week migration timeline realistic given your current development priorities?

3. **Technology Constraints**: Any concerns with the enhanced Redis queue architecture for your infrastructure?

4. **Team Readiness**: Does your team have experience with event-driven architectures and domain-driven design patterns?

5. **Performance Requirements**: Are there specific latency or throughput requirements that would affect service boundaries?
