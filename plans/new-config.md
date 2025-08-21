# Configuration System Migration Plan: Proper Architectural Separation

## Executive Summary

This plan outlines the migration of eco-solver configuration logic with **proper architectural separation**. The `@libs/config` library provides **generic infrastructure** (Zod validation, AWS SDK v3, caching) and should remain application-agnostic. All eco-solver specific functionality will be implemented in `@libs/solver-config`, which will consume and leverage the generic infrastructure from `@libs/config`.

## Corrected Architecture Approach

### 🎯 **Key Architectural Principle: Separation of Concerns**

```
┌─────────────────────────────────────┐
│    @libs/config                     │
│    Generic Infrastructure Layer     │
│  ┌─────────────────────────────────┐ │
│  │ • Zod validation framework      │ │
│  │ • AWS SDK v3 providers         │ │  
│  │ • Configuration caching        │ │
│  │ • Generic schemas (server,     │ │
│  │   database, aws, cache, etc.)  │ │
│  │ • ConfigurationService         │ │
│  │ • Testing utilities            │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
            ▲ Uses/Imports
            │
┌─────────────────────────────────────┐
│    @libs/solver-config              │
│    Eco-Solver Specific Layer       │
│  ┌─────────────────────────────────┐ │
│  │ • Eco-solver specific schemas   │ │
│  │ • EcoConfigService              │ │
│  │ • Chain configuration utils    │ │
│  │ • Intent source logic          │ │
│  │ • Solver-specific types        │ │
│  │ • Business logic integration   │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Current State Analysis

### ✅ **@libs/config** - Generic Infrastructure (KEEP GENERIC)
```typescript
// Modern 2025 infrastructure already in place:
libs/config/
├── src/services/                     # Generic configuration services
│   ├── configuration.service.ts      # Zod validation + caching
│   └── configuration-cache.service.ts
├── schemas/                          # Generic Zod schemas  
│   ├── server.schema.ts              # Generic server config
│   ├── aws.schema.ts                 # Generic AWS config
│   ├── database.schema.ts            # Generic database config
│   └── cache.schema.ts               # Generic cache config
├── providers/                        # Generic providers
│   ├── aws-v3/aws-secrets.provider.ts # AWS SDK v3 provider
│   └── server/server-config.provider.ts
└── testing/                          # Testing utilities
```

**ARCHITECTURE DECISION**: Keep `@libs/config` completely generic and reusable

### 🔧 **@libs/solver-config** - Simple Static Loader (EXTEND)
```typescript  
// Current minimal functionality:
libs/solver-config/
└── src/lib/
    ├── solver-config.ts              # Simple static config loader
    └── configs/                      # Environment configs
        ├── default.ts, development.ts, production.ts, etc.
```

**ARCHITECTURE DECISION**: Transform into eco-solver specific consumer of `@libs/config`

### 🚛 **@apps/eco-solver/src/eco-configs/** - Legacy System (MIGRATE)
```typescript
// Complex eco-solver functionality to migrate:
eco-configs/
├── eco-config.service.ts             # 430+ lines, 30+ getters
├── eco-config.module.ts              # NestJS module
├── aws-config.service.ts             # AWS Secrets (OLD SDK v2)
├── interfaces/config-source.interface.ts
└── eco-config.types.ts               # 450+ lines of types
```

**ARCHITECTURE DECISION**: Migrate to `@libs/solver-config` using generic infrastructure

## Migration Strategy

### 🎯 Phase 1: Create Eco-Solver Schemas in @libs/solver-config (Week 1)

#### 1.1 Add Eco-Solver Specific Schemas
Create eco-solver schemas in the **correct location** - `@libs/solver-config`:

```typescript
// libs/solver-config/src/lib/schemas/eco-solver.schema.ts - NEW
import { z } from 'zod'

// Import generic schemas from @libs/config
import { 
  ServerConfigSchema,
  AwsConfigSchema, 
  CacheConfigSchema,
  DatabaseConfigSchema 
} from '@libs/config/schemas'

// Eco-solver specific schemas
export const SolverConfigSchema = z.object({
  chainID: z.number(),
  inboxAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  network: z.string(),
  targets: z.record(z.string(), z.object({
    contractType: z.enum(['erc20', 'erc721', 'erc1155']),
    selectors: z.array(z.string()),
    minBalance: z.number(),
    targetBalance: z.number(),
  })),
  fee: z.object({
    limit: z.object({
      tokenBase6: z.bigint(),
      nativeBase18: z.bigint(),
    }),
    algorithm: z.enum(['linear', 'quadratic']),
    constants: z.any(),
  }),
  averageBlockTime: z.number(),
  gasOverhead: z.number().optional(),
})

export const IntentSourceSchema = z.object({
  network: z.string(),
  chainID: z.number(),
  sourceAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  inbox: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  tokens: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)),
  provers: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)),
  config: z.object({
    ecoRoutes: z.enum(['append', 'replace']),
  }).optional(),
})

// Complete eco-solver config schema using generic base schemas
export const EcoSolverConfigSchema = z.object({
  // Use generic schemas from @libs/config
  server: ServerConfigSchema,
  aws: z.array(AwsConfigSchema),  
  cache: CacheConfigSchema,
  database: DatabaseConfigSchema,
  
  // Add eco-solver specific sections
  solvers: z.record(z.number(), SolverConfigSchema),
  intentSources: z.array(IntentSourceSchema),
  rpcs: z.object({
    keys: z.record(z.string(), z.string()),
    config: z.object({
      webSockets: z.boolean().optional(),
    }),
    custom: z.record(z.string(), z.any()).optional(),
  }),
  fulfill: z.any(), // Define more specific schemas
  kms: z.any(),
  safe: z.any(),
  launchDarkly: z.any(),
  analytics: z.any(),
  eth: z.any(),
  intervals: z.any(),
  // ... all other eco-solver specific config sections
})

export type EcoSolverConfigType = z.infer<typeof EcoSolverConfigSchema>
export type Solver = z.infer<typeof SolverConfigSchema>
export type IntentSource = z.infer<typeof IntentSourceSchema>
```

#### 1.2 Update @libs/solver-config Dependencies
Add dependencies to consume generic infrastructure:

```json
// libs/solver-config/package.json - UPDATED
{
  "dependencies": {
    "tslib": "^2.3.0",
    "lodash": "^4.17.21",
    
    // NEW: Consume generic infrastructure from @libs/config
    "@libs/config": "workspace:*",
    
    // NEW: Modern dependencies for NestJS integration
    "@nestjs/common": "^10.3.0",
    "@nestjs/config": "^3.1.1",
    "zod": "^3.22.4",
    
    // Existing dependencies
    "@eco-foundation/chains": "workspace:*",
    "@eco-foundation/routes-ts": "workspace:*",
    "viem": "^2.0.0"
  },
  "devDependencies": {
    "@nestjs/testing": "^10.3.0"
  }
}
```

### 🎯 Phase 2: Create EcoSolverConfigService in @libs/solver-config (Week 2)

#### 2.1 Create Eco-Solver Service Using Generic Infrastructure
Build eco-solver service that **consumes** `@libs/config`:

```typescript
// libs/solver-config/src/lib/services/eco-solver-config.service.ts - NEW
import { Injectable, Logger } from '@nestjs/common'
import { merge } from 'lodash'

// Import generic infrastructure from @libs/config
import { 
  ConfigurationService,
  AwsSecretsProvider 
} from '@libs/config'

// Import eco-solver specific schemas (in this library)
import { 
  EcoSolverConfigSchema,
  type EcoSolverConfigType,
  type Solver,
  type IntentSource
} from '../schemas/eco-solver.schema'

// Static config is now handled by generic ConfigurationService
// No direct imports from solver-config files

// Import utilities (will be created)
import { getChainConfig } from '../utils/chain-config.utils'
import { addressKeys } from '../utils/address.utils'

@Injectable()
export class EcoSolverConfigService {
  private readonly logger = new Logger(EcoSolverConfigService.name)
  private mergedConfig: EcoSolverConfigType

  constructor(
    private readonly configService: ConfigurationService, // Generic service
    private readonly awsProvider?: AwsSecretsProvider,     // Generic AWS provider
  ) {}

  async initializeConfig(): Promise<void> {
    // Load base configuration using generic infrastructure
    // The generic ConfigurationService handles file loading, environment merging
    const staticConfig = await this.configService.get('eco-solver', EcoSolverConfigSchema)
    
    // Load AWS secrets using generic provider
    let awsConfig = {}
    if (this.awsProvider && staticConfig.aws) {
      const secrets = await Promise.allSettled(
        staticConfig.aws.map(cred => 
          this.awsProvider!.loadSecret(cred.secretID, cred.region)
        )
      )
      
      awsConfig = secrets
        .filter((result): result is PromiseFulfilledResult<any> => 
          result.status === 'fulfilled')
        .reduce((acc, result) => merge(acc, result.value), {})
    }

    // Merge configs and validate with eco-solver schema
    const mergedRawConfig = merge({}, awsConfig, staticConfig )
    this.mergedConfig = EcoSolverConfigSchema.parse(mergedRawConfig)
  }

  // All eco-solver specific getters with validation
  getRpcConfig(): EcoSolverConfigType['rpcs'] {
    return this.mergedConfig.rpcs
  }

  getAwsConfigs(): EcoSolverConfigType['aws'] {
    return this.mergedConfig.aws
  }

  getCache(): EcoSolverConfigType['cache'] {
    return this.mergedConfig.cache
  }

  getSolvers(): Record<number, Solver> {
    const solvers = this.mergedConfig.solvers
    // Apply chain config transformations (existing business logic)
    return Object.fromEntries(
      Object.entries(solvers).map(([chainId, solver]) => {
        const config = getChainConfig(parseInt(chainId))
        return [chainId, {
          ...solver,
          inboxAddress: config.Inbox,
          targets: addressKeys(solver.targets) ?? {},
        }]
      })
    )
  }

  getSolver(chainID: number | bigint): Solver | undefined {
    const id = typeof chainID === 'bigint' ? Number(chainID) : chainID
    return this.getSolvers()[id]
  }

  getIntentSources(): IntentSource[] {
    return this.mergedConfig.intentSources.map(intent => {
      const config = getChainConfig(intent.chainID)
      return {
        ...intent,
        sourceAddress: config.IntentSource,
        inbox: config.Inbox,
        // Apply existing business logic transformations
        provers: this.processProvers(intent, config),
        tokens: intent.tokens.map(token => getAddress(token)),
      }
    })
  }

  getIntentSource(chainID: number): IntentSource | undefined {
    return this.getIntentSources().find(intent => intent.chainID === chainID)
  }

  // All other 30+ configuration getters from EcoConfigService
  getServer(): EcoSolverConfigType['server'] {
    return this.mergedConfig.server
  }

  getDatabaseConfig(): EcoSolverConfigType['database'] {
    return this.mergedConfig.database  
  }

  // ... continue with all other getters, applying business logic as needed
  // getFulfill(), getKmsConfig(), getSafe(), etc.

  private processProvers(intent: IntentSource, config: any): string[] {
    // Existing prover processing logic from EcoConfigService
    const ecoNpm = intent.config?.ecoRoutes || 'append'
    const ecoNpmProvers = [config.HyperProver, config.MetaProver]
      .filter(prover => getAddress(prover) !== zeroAddress)

    switch (ecoNpm) {
      case 'replace':
        return ecoNpmProvers
      case 'append':
      default:
        return [...(intent.provers || []), ...ecoNpmProvers]
    }
  }
}
```

#### 2.2 Create Eco-Solver Module
Create module that uses generic infrastructure:

```typescript
// libs/solver-config/src/lib/modules/eco-solver-config.module.ts - NEW
import { DynamicModule, Module } from '@nestjs/common'

// Import generic infrastructure
import { 
  ConfigModule,           // Generic config module  
  AwsSecretsProvider     // Generic AWS provider
} from '@libs/config'

// Import eco-solver specific service
import { EcoSolverConfigService } from '../services/eco-solver-config.service'

@Module({})
export class EcoSolverConfigModule {
  static forRoot(options: { 
    enableAws?: boolean
    awsRegion?: string 
  } = {}): DynamicModule {
    const providers = [EcoSolverConfigService]
    const imports = [ConfigModule] // Use generic config module

    // Add AWS provider if enabled
    if (options.enableAws && options.awsRegion) {
      providers.push({
        provide: AwsSecretsProvider,
        useFactory: () => AwsSecretsProvider.create({
          region: options.awsRegion!,
        }),
      })
    }

    return {
      global: true,
      module: EcoSolverConfigModule,
      imports,
      providers,
      exports: [EcoSolverConfigService],
    }
  }

  // Backward compatibility methods
  static withAWS(): DynamicModule {
    return this.forRoot({
      enableAws: true,
      awsRegion: process.env.AWS_REGION || 'us-east-2',
    })
  }

  static base(): DynamicModule {
    return this.forRoot({ enableAws: false })
  }
}
```

#### 2.3 Create Eco-Solver Utility Functions
Move utilities to the correct location:

```typescript
// libs/solver-config/src/lib/utils/chain-config.utils.ts - NEW
import { EcoChainConfig, EcoProtocolAddresses } from '@eco-foundation/routes-ts'

export enum NodeEnv {
  production = 'production',
  preproduction = 'preproduction',
  staging = 'staging', 
  development = 'development',
}

export function getNodeEnv(): NodeEnv {
  const env = process.env.NODE_ENV || 'development'
  return NodeEnv[env.toLowerCase() as keyof typeof NodeEnv] || NodeEnv.development
}

export function isPreEnv(): boolean {
  const env = getNodeEnv()
  return [NodeEnv.preproduction, NodeEnv.development, NodeEnv.staging].includes(env)
}

export function getChainConfig(chainID: number | string): EcoChainConfig {
  const id = isPreEnv() ? `${chainID}-pre` : chainID.toString()
  const config = EcoProtocolAddresses[id]
  if (!config) {
    throw new Error(`Chain config not found for ${id}`)
  }
  return config
}
```

### 🎯 Phase 3: Application Integration & Backward Compatibility (Week 3)

#### 3.1 Update Application Module  
Replace legacy eco-configs with modernized solver-config:

```typescript
// apps/eco-solver/src/app/app.module.ts - UPDATED
import { Module } from '@nestjs/common'

// Replace legacy import
// import { EcoConfigModule } from '../eco-configs/eco-config.module' // OLD

// Use modernized solver-config
import { EcoSolverConfigModule } from '@libs/solver-config' // NEW

@Module({
  imports: [
    // Use modern configuration system that leverages generic infrastructure
    EcoSolverConfigModule.withAWS(),
    // ... other imports remain the same
  ],
  // ... rest of module
})
export class AppModule {}
```

#### 3.2 Create Backward Compatibility Layer
Ensure zero breaking changes during migration:

```typescript
// apps/eco-solver/src/eco-configs/index.ts - COMPATIBILITY LAYER
// This file provides backward compatibility for existing imports

import { 
  EcoSolverConfigService as ModernEcoConfigService,
  EcoSolverConfigModule as ModernEcoConfigModule,
} from '@libs/solver-config'

// Export with original names for backward compatibility
export const EcoConfigService = ModernEcoConfigService
export const EcoConfigModule = ModernEcoConfigModule

// Re-export all types for compatibility
export type {
  EcoSolverConfigType as EcoConfigType,
  Solver,
  IntentSource,
  // ... all other types
} from '@libs/solver-config'

// Deprecated warnings for gradual migration
console.warn(
  '[DEPRECATED] Importing from eco-configs is deprecated. ' +
  'Use @libs/solver-config directly. This compatibility layer will be removed in v2.0.0'
)
```

#### 3.3 Enhanced Static Configuration Integration
Update static config to work with generic infrastructure:

```typescript
// libs/solver-config/src/lib/solver-config.ts - CORRECTED ARCHITECTURE
import { EcoSolverConfigType } from './schemas/eco-solver.schema'
import { ConfigurationService } from '@libs/config'
import { merge } from 'lodash'

/**
 * Static configuration loader that leverages generic infrastructure
 * NO direct file access - uses ConfigurationService from @libs/config
 */
export class StaticSolverConfig {
  private static instance: StaticSolverConfig
  private config: EcoSolverConfigType

  private constructor(
    private readonly configService: ConfigurationService,
    environment?: string
  ) {
    // Config is provided by the generic infrastructure, not loaded directly
    this.config = this.processConfig(environment)
  }

  static async createInstance(
    configService: ConfigurationService,
    environment?: string
  ): Promise<StaticSolverConfig> {
    if (!StaticSolverConfig.instance) {
      StaticSolverConfig.instance = new StaticSolverConfig(configService, environment)
    }
    return StaticSolverConfig.instance
  }

  private processConfig(environment?: string): EcoSolverConfigType {
    // Use ConfigurationService to get configuration data
    // The generic service handles file loading, environment merging, etc.
    try {
      // Get base configuration through generic infrastructure
      const config = this.configService.getSync('eco-solver', EcoSolverConfigSchema)
      return config
    } catch (error) {
      // Fallback to minimal config if service unavailable
      return this.getFallbackConfig()
    }
  }

  private getFallbackConfig(): EcoSolverConfigType {
    // Minimal fallback - only when generic service unavailable
    return {
      aws: [],
      cache: { ttl: 10000 },
      server: { url: 'http://localhost:3000' },
      // ... other minimal required fields
    } as EcoSolverConfigType
  }

  get<K extends keyof EcoSolverConfigType>(key: K): EcoSolverConfigType[K] {
    return this.config[key]
  }

  getAll(): EcoSolverConfigType {
    return this.config
  }

  async reload(environment?: string): Promise<void> {
    // Reload through generic infrastructure
    await this.configService.reload()
    this.config = this.processConfig(environment)
  }
}

/**
 * Factory function that creates static config using generic infrastructure
 * This replaces direct file access with proper service consumption
 */
export async function createStaticSolverConfig(
  configService: ConfigurationService,
  environment?: string
): Promise<EcoSolverConfigType> {
  const instance = await StaticSolverConfig.createInstance(configService, environment)
  return instance.getAll()
}

/**
 * Legacy compatibility function - will be deprecated
 * @deprecated Use createStaticSolverConfig with ConfigurationService instead
 */
export function getStaticSolverConfig(environment?: string): EcoSolverConfigType {
  console.warn('[DEPRECATED] getStaticSolverConfig should be replaced with createStaticSolverConfig')
  // Return minimal config for backward compatibility during migration
  return {
    aws: [],
    cache: { ttl: 10000 },
    server: { url: 'http://localhost:3000' },
    // ... other minimal fields from existing configs/default.ts
  } as EcoSolverConfigType
}
```

### 🎯 Phase 4: Testing & Migration Cleanup (Week 4)

#### 4.1 Comprehensive Testing Strategy
Create test suites that validate the architectural separation:

```typescript
// libs/solver-config/src/lib/services/eco-solver-config.service.spec.ts - NEW
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigurationService, AwsSecretsProvider } from '@libs/config'
import { EcoSolverConfigService } from './eco-solver-config.service'

describe('EcoSolverConfigService (Architectural Separation)', () => {
  let service: EcoSolverConfigService
  let configService: jest.Mocked<ConfigurationService>
  let awsProvider: jest.Mocked<AwsSecretsProvider>

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
      getSync: jest.fn(),
      reload: jest.fn(),
    }

    const mockAwsProvider = {
      loadSecret: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EcoSolverConfigService,
        {
          provide: ConfigurationService,
          useValue: mockConfigService,
        },
        {
          provide: AwsSecretsProvider,
          useValue: mockAwsProvider,
        },
      ],
    }).compile()

    service = module.get<EcoSolverConfigService>(EcoSolverConfigService)
    configService = module.get(ConfigurationService)
    awsProvider = module.get(AwsSecretsProvider)
  })

  it('should use generic infrastructure from @libs/config', async () => {
    // Verify that service uses generic ConfigurationService
    expect(configService).toBeDefined()
    expect(awsProvider).toBeDefined()
  })

  it('should validate eco-solver specific schemas', async () => {
    await service.initializeConfig()
    
    const solvers = service.getSolvers()
    expect(typeof solvers).toBe('object')
    
    // Verify Zod validation is applied to eco-solver specific data
    Object.values(solvers).forEach(solver => {
      expect(solver).toHaveProperty('chainID')
      expect(solver).toHaveProperty('inboxAddress')
      expect(typeof solver.chainID).toBe('number')
    })
  })

  it('should apply eco-solver specific business logic', () => {
    const intentSources = service.getIntentSources()
    
    // Verify eco-solver specific transformations
    intentSources.forEach(source => {
      expect(source.sourceAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(source.inbox).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })
  })

  it('should handle AWS integration via generic provider', async () => {
    awsProvider.loadSecret.mockResolvedValue({
      database: { password: 'secret-password' }
    })
    
    await service.initializeConfig()
    
    // Verify AWS provider is used correctly
    expect(awsProvider.loadSecret).toHaveBeenCalled()
    expect(service.getDatabaseConfig()).toBeDefined()
  })
})
```

#### 4.2 Architecture Validation Tests
Ensure architectural boundaries are maintained:

```typescript
// libs/solver-config/src/lib/architecture.spec.ts - NEW  
describe('Architecture Validation', () => {
  it('should not have direct imports from apps/ directories', () => {
    // Verify no imports from application layer
    const sourceFiles = /* get all source files */
    
    sourceFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8')
      expect(content).not.toContain("from '../../../apps/")
      expect(content).not.toContain("from '@apps/")
    })
  })

  it('should only import generic infrastructure from @libs/config', () => {
    // Verify only imports from generic config, not application-specific
    const imports = /* extract imports from source files */
    
    imports.forEach(importPath => {
      if (importPath.includes('@libs/config')) {
        // Should only import from generic parts
        expect(importPath).not.toContain('eco-')
        expect(importPath).not.toContain('solver-')
      }
    })
  })

  it('should properly separate generic and specific concerns', () => {
    // Verify @libs/config remains generic
    const configFiles = /* get @libs/config source files */
    
    configFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8')
      
      // Should not contain eco-solver specific terms
      expect(content).not.toContain('solver')
      expect(content).not.toContain('intent')
      expect(content).not.toContain('eco-')
    })
  })
})
```

#### 4.3 Migration Script & Cleanup
Create automated migration utilities:

```typescript
// scripts/migrate-to-proper-architecture.ts - NEW
#!/usr/bin/env ts-node

import * as fs from 'fs'
import * as path from 'path'

async function migrateToProperArchitecture() {
  console.log('🏗️ Migrating to proper architectural separation...')

  // Step 1: Update import statements
  await updateImports()

  // Step 2: Verify no eco-solver specific code in @libs/config
  await validateGenericLibrary()

  // Step 3: Clean up legacy eco-configs
  await cleanupLegacyConfigs()

  console.log('✅ Architecture migration completed!')
}

async function updateImports() {
  const files = await findTsFiles('apps/eco-solver/src')
  
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8')
    let hasChanges = false

    // Replace imports to use proper architectural layers
    const replacements = [
      {
        old: "from './eco-configs/eco-config.service'",
        new: "from '@libs/solver-config'", // Eco-solver specific
      },
      {
        old: "from '@libs/config'",
        new: "from '@libs/config'", // Generic infrastructure (no change)
      },
    ]

    replacements.forEach(({ old, new: newImport }) => {
      if (content.includes(old)) {
        content = content.replace(new RegExp(old, 'g'), newImport)
        hasChanges = true
      }
    })

    if (hasChanges) {
      fs.writeFileSync(file, content)
      console.log(`✅ Updated imports in ${file}`)
    }
  }
}

async function validateGenericLibrary() {
  const configFiles = await findTsFiles('libs/config/src')
  
  for (const file of configFiles) {
    const content = fs.readFileSync(file, 'utf-8')
    
    // Ensure @libs/config remains generic
    if (content.includes('solver') || content.includes('eco-') || content.includes('intent')) {
      console.error(`❌ Generic library contaminated: ${file}`)
      console.error('   @libs/config should not contain eco-solver specific code')
      process.exit(1)
    }
  }
  
  console.log('✅ Generic library validation passed')
}

async function cleanupLegacyConfigs() {
  console.log('🧹 Cleaning up legacy eco-configs...')
  
  // After migration is complete and tested
  const legacyDir = 'apps/eco-solver/src/eco-configs'
  
  if (fs.existsSync(legacyDir)) {
    // Move to backup directory instead of deleting
    const backupDir = 'apps/eco-solver/src/eco-configs.backup'
    fs.renameSync(legacyDir, backupDir)
    console.log(`📦 Legacy configs backed up to ${backupDir}`)
  }
}

// Helper function to find TypeScript files
async function findTsFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  const items = fs.readdirSync(dir)

  for (const item of items) {
    const fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory() && item !== 'node_modules' && item !== 'dist') {
      files.push(...await findTsFiles(fullPath))
    } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
      files.push(fullPath)
    }
  }

  return files
}

// Run migration
migrateToProperArchitecture().catch(console.error)
```

## Implementation Checklist

### 📋 Phase 1: Create Eco-Solver Schemas in @libs/solver-config (Week 1)
- [ ] Create `libs/solver-config/src/lib/schemas/eco-solver.schema.ts`
- [ ] Add eco-solver specific Zod schemas (Solver, IntentSource, etc.)
- [ ] Import and use generic schemas from `@libs/config/schemas`
- [ ] Create complete `EcoSolverConfigSchema` combining generic + specific
- [ ] Export types with proper naming (EcoSolverConfigType, etc.)
- [ ] Update `@libs/solver-config` dependencies to include `@libs/config`

### 📋 Phase 2: Create EcoSolverConfigService in @libs/solver-config (Week 2)
- [ ] Create `EcoSolverConfigService` that uses `ConfigurationService` from `@libs/config`
- [ ] Create `EcoSolverConfigModule` that uses generic `ConfigModule`
- [ ] Migrate all 30+ configuration getters with Zod validation
- [ ] Move chain configuration and environment utilities to `@libs/solver-config`
- [ ] Ensure service consumes `AwsSecretsProvider` from `@libs/config`
- [ ] Preserve all existing business logic transformations

### 📋 Phase 3: Application Integration (Week 3)  
- [ ] Replace `EcoConfigModule` with `EcoSolverConfigModule` in app.module.ts
- [ ] Create backward compatibility layer in `apps/eco-solver/src/eco-configs/`
- [ ] Test all existing functionality works with new architecture
- [ ] Verify AWS integration works with generic providers
- [ ] Update static config integration with enhanced patterns

### 📋 Phase 4: Testing & Cleanup (Week 4)
- [ ] Create comprehensive test suites validating architectural separation
- [ ] Add architecture validation tests to prevent boundary violations  
- [ ] Create performance tests to ensure no regression
- [ ] Run migration script with proper architecture validation
- [ ] Clean up legacy eco-config files after successful migration
- [ ] Update documentation to reflect proper architectural separation

## Architectural Benefits

### 🏗️ **Proper Separation of Concerns**
- **@libs/config**: Remains completely generic and reusable by any application
- **@libs/solver-config**: Contains all eco-solver specific functionality
- **Clear boundaries**: No eco-solver code pollutes the generic infrastructure
- **Maintainable**: Each library has a single, well-defined responsibility

### 🚀 **Leverages Existing Infrastructure**  
- **No duplication**: `@libs/solver-config` uses existing modern patterns
- **Consistent**: All configuration follows same architectural approach
- **Validated**: Zod schemas ensure type safety across the system  
- **Cached**: Benefits from existing caching infrastructure
- **Modern**: Uses AWS SDK v3, NestJS patterns, etc.

### 🔧 **Easy Extension**
- **New applications** can use generic `@libs/config` infrastructure
- **Domain-specific libraries** can be created following same pattern
- **Reusable**: Generic infrastructure serves multiple use cases
- **Scalable**: Architecture supports growth without technical debt

## Risk Mitigation

### ⚠️ **Architectural Governance**
1. **Linting Rules**: Add rules to prevent importing app-specific code into generic libraries
2. **CI/CD Validation**: Automated checks for architectural boundary violations
3. **Code Reviews**: Enforce separation of concerns during development
4. **Documentation**: Clear guidelines for maintaining architectural boundaries

### ⚠️ **Migration Safety**
1. **Backward Compatibility**: Maintain compatibility layer throughout migration
2. **Incremental Migration**: Migrate one service at a time with full testing
3. **Rollback Plan**: Keep legacy system functional until migration is verified
4. **Comprehensive Testing**: Test all integration points and business logic

## Success Metrics

### 📊 **Architectural Quality**
- [ ] Zero eco-solver specific code in `@libs/config` 
- [ ] All eco-solver logic properly contained in `@libs/solver-config`
- [ ] Generic infrastructure successfully reused by eco-solver application
- [ ] Clear dependency graph: solver-config → config (not bidirectional)

### 📊 **Migration Success**  
- [ ] All existing functionality preserved and working
- [ ] Zero breaking changes for consuming applications
- [ ] All tests passing (existing + new architecture validation)
- [ ] Performance maintained or improved
- [ ] Type safety improved with proper Zod validation

## Conclusion

This corrected migration plan ensures **proper architectural separation**:

1. **@libs/config** remains a **generic infrastructure library** - no eco-solver contamination
2. **@libs/solver-config** becomes the **eco-solver specific consumer** - uses generic infrastructure  
3. **Clear separation of concerns** - each library has well-defined responsibilities
4. **Maintainable architecture** - easy to extend, modify, and understand

### 🎯 **Key Architectural Decision**

Instead of polluting the generic infrastructure with application-specific code, we:

- **Keep `@libs/config` pure** - only generic, reusable patterns
- **Make `@libs/solver-config` the consumer** - contains all eco-solver specifics  
- **Establish clear boundaries** - prevents architectural erosion over time
- **Enable future growth** - other applications can use the generic infrastructure

This approach follows **SOLID principles**, maintains **clean architecture**, and ensures long-term maintainability while leveraging existing modern infrastructure.
