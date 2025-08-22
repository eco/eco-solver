# Configuration System Migration Plan: Enhanced Dynamic Provider Architecture

## Executive Summary

This updated plan improves on the original architecture by implementing a **proper dynamic provider system** where:

1. **EcoSolverConfigModule dynamically creates providers** based on static config analysis
2. **ConfigSource interface standardizes all providers** (AWS, file-based, etc.)
3. **EcoSolverConfigService receives an array of async ConfigSources** and uses Promise.allSettled
4. **Clean separation of concerns** - module handles provider creation, service handles config merging

## 🎯 Key Architectural Improvements

### Current Problems:

- AWS provider is hardcoded in the module
- Service knows about specific provider types (AWS, static)
- No standardized interface for different config sources
- Manual provider management

### Proposed Solution:

```typescript
interface ConfigSource {
  getConfig(): Promise<Record<string, any>>
  priority: number // For merge order
  name: string // For logging/debugging
}

// Module creates providers based on static config
// Service works with generic ConfigSource[] array
```

## 🏗️ Enhanced Architecture Design

```
┌─────────────────────────────────────────────┐
│  EcoSolverConfigModule.forRoot(config)      │
│  ┌─────────────────────────────────────────┐ │
│  │ 1. Analyze static config                │ │
│  │ 2. Create providers based on needs:     │ │
│  │    - StaticConfigProvider (always)      │ │
│  │    - AwsSecretsProvider (if aws found)  │ │
│  │    - FileOverrideProvider (if files)    │ │
│  │    - EnvVarProvider (if enabled)        │ │
│  │ 3. Inject providers as ConfigSource[]   │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
             │ Provides ConfigSource[]
             ▼
┌─────────────────────────────────────────────┐
│  EcoSolverConfigService                     │
│  ┌─────────────────────────────────────────┐ │
│  │ constructor(sources: ConfigSource[])     │ │
│  │                                         │ │
│  │ async initializeConfig() {              │ │
│  │   const results = await Promise        │ │
│  │     .allSettled(sources.map(s =>       │ │
│  │       s.getConfig()))                  │ │
│  │                                         │ │
│  │   // Merge by priority order           │ │
│  │   mergedConfig = mergeConfigs(results)  │ │
│  │ }                                       │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## 📋 Implementation Plan

### Phase 1: Create ConfigSource Interface and Base Providers

#### 1.1 Update ConfigSource Interface

```typescript
// libs/solver-config/src/lib/interfaces/config-source.interface.ts
export interface ConfigSource {
  getConfig(): Promise<Record<string, any>>
  priority: number // Lower = higher priority (0 = highest)
  name: string // For logging/debugging
  enabled: boolean // Allow dynamic enable/disable
}

export abstract class BaseConfigSource implements ConfigSource {
  abstract priority: number
  abstract name: string

  enabled: boolean = true

  abstract getConfig(): Promise<Record<string, any>>

  protected handleError(error: any, context: string): Record<string, any> {
    console.warn(`[${this.name}] Failed to load config from ${context}:`, error.message)
    return {} // Return empty config on failure
  }
}
```

#### 1.2 Create Provider Implementations

```typescript
// libs/solver-config/src/lib/providers/static-config.provider.ts
import { Injectable } from '@nestjs/common'
import { ConfigurationService } from '@libs/config'
import { BaseConfigSource } from '../interfaces/config-source.interface'
import { EcoSolverConfigSchema } from '../schemas/eco-solver.schema'

@Injectable()
export class StaticConfigProvider extends BaseConfigSource {
  priority = 100 // Lowest priority - base config
  name = 'StaticConfig'

  constructor(private readonly configService: ConfigurationService) {
    super()
  }

  async getConfig(): Promise<Record<string, any>> {
    try {
      return await this.configService.get('eco-solver', EcoSolverConfigSchema)
    } catch (error) {
      return this.handleError(error, 'static configuration files')
    }
  }
}

// libs/solver-config/src/lib/providers/aws-secrets.provider.ts
import { Injectable } from '@nestjs/common'
import { AwsSecretsProvider as GenericAwsProvider } from '@libs/config'
import { BaseConfigSource } from '../interfaces/config-source.interface'

@Injectable()
export class AwsSecretsConfigProvider extends BaseConfigSource {
  priority = 50 // Medium priority - external secrets
  name = 'AwsSecrets'

  constructor(
    private readonly awsProvider: GenericAwsProvider,
    private readonly awsCredentials: any[],
  ) {
    super()
  }

  async getConfig(): Promise<Record<string, any>> {
    if (!this.awsCredentials?.length) {
      return {}
    }

    try {
      const results = await Promise.allSettled(
        this.awsCredentials.map((cred) => this.awsProvider.loadSecret(cred.secretID, cred.region)),
      )

      return results
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .reduce((acc, result) => ({ ...acc, ...result.value }), {})
    } catch (error) {
      return this.handleError(error, 'AWS Secrets Manager')
    }
  }
}

// libs/solver-config/src/lib/providers/env-override.provider.ts
import { Injectable } from '@nestjs/common'
import { BaseConfigSource } from '../interfaces/config-source.interface'

@Injectable()
export class EnvOverrideProvider extends BaseConfigSource {
  priority = 10 // High priority - environment overrides
  name = 'EnvOverride'

  async getConfig(): Promise<Record<string, any>> {
    // Parse environment variables with ECO_CONFIG_ prefix
    const envConfig: Record<string, any> = {}

    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('ECO_CONFIG_')) {
        const configKey = key.replace('ECO_CONFIG_', '').toLowerCase()
        const value = process.env[key]

        try {
          // Try to parse as JSON, fallback to string
          envConfig[configKey] = JSON.parse(value!)
        } catch {
          envConfig[configKey] = value
        }
      }
    })

    return envConfig
  }
}
```

### Phase 2: Enhanced Dynamic Module Creation

#### 2.1 Smart Module Factory

```typescript
// libs/solver-config/src/lib/modules/eco-solver-config.module.ts
import { DynamicModule, Module, Provider } from '@nestjs/common'
import { ConfigModule } from '@libs/config'
import { EcoSolverConfigService } from '../services/eco-solver-config.service'
import { StaticConfigProvider } from '../providers/static-config.provider'
import { AwsSecretsConfigProvider } from '../providers/aws-secrets.provider'
import { EnvOverrideProvider } from '../providers/env-override.provider'
import { getStaticSolverConfig } from '../solver-config'

export interface EcoSolverConfigOptions {
  enableAws?: boolean
  enableEnvOverrides?: boolean
  awsRegion?: string
  customProviders?: Provider[]
}

@Module({})
export class EcoSolverConfigModule {
  static forRoot(options: EcoSolverConfigOptions = {}): DynamicModule {
    // 1. Analyze static config to determine what providers are needed
    const staticConfig = getStaticSolverConfig()
    const needsAws = staticConfig.aws?.length > 0 || options.enableAws

    // 2. Build provider array based on analysis
    const providers: Provider[] = [
      // Always include static config provider
      StaticConfigProvider,

      // Core service that receives the providers
      {
        provide: EcoSolverConfigService,
        useFactory: async (...configSources: any[]) => {
          const service = new EcoSolverConfigService(configSources)
          await service.initializeConfig()
          return service
        },
        inject: [
          StaticConfigProvider,
          ...(needsAws ? [AwsSecretsConfigProvider] : []),
          ...(options.enableEnvOverrides ? [EnvOverrideProvider] : []),
        ],
      },
    ]

    // 3. Conditionally add AWS provider if needed
    if (needsAws) {
      providers.push({
        provide: AwsSecretsConfigProvider,
        useFactory: (staticProvider: StaticConfigProvider, awsProvider: any) => {
          return new AwsSecretsConfigProvider(awsProvider, staticConfig.aws)
        },
        inject: [StaticConfigProvider, 'AWS_SECRETS_PROVIDER'],
      })

      // Add generic AWS provider
      providers.push({
        provide: 'AWS_SECRETS_PROVIDER',
        useFactory: () => {
          const { AwsSecretsProvider } = require('@libs/config')
          return AwsSecretsProvider.create({
            region: options.awsRegion || process.env.AWS_REGION || 'us-east-2',
          })
        },
      })
    }

    // 4. Add environment override provider if enabled
    if (options.enableEnvOverrides) {
      providers.push(EnvOverrideProvider)
    }

    // 5. Add any custom providers
    if (options.customProviders?.length) {
      providers.push(...options.customProviders)
    }

    return {
      global: true,
      module: EcoSolverConfigModule,
      imports: [ConfigModule], // Generic config infrastructure
      providers,
      exports: [EcoSolverConfigService],
    }
  }

  // Convenience methods for common configurations
  static withAWS(region = 'us-east-2'): DynamicModule {
    return this.forRoot({
      enableAws: true,
      enableEnvOverrides: true,
      awsRegion: region,
    })
  }

  static withFullFeatures(): DynamicModule {
    return this.forRoot({
      enableAws: true,
      enableEnvOverrides: true,
    })
  }

  static base(): DynamicModule {
    return this.forRoot({ enableAws: false })
  }
}
```

### Phase 3: Enhanced Service Implementation

#### 3.1 Provider-Agnostic Service

```typescript
// libs/solver-config/src/lib/services/eco-solver-config.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { ConfigSource } from '../interfaces/config-source.interface'
import { EcoSolverConfigSchema, type EcoSolverConfigType } from '../schemas/eco-solver.schema'
import { merge } from 'lodash'

@Injectable()
export class EcoSolverConfigService {
  private readonly logger = new Logger(EcoSolverConfigService.name)
  private mergedConfig: EcoSolverConfigType
  private initialized = false

  constructor(private readonly configSources: ConfigSource[]) {
    // Service doesn't know about specific providers - just works with ConfigSource[]
    this.logger.log(
      `Initialized with ${configSources.length} config sources: ${configSources
        .map((s) => s.name)
        .join(', ')}`,
    )
  }

  async initializeConfig(): Promise<void> {
    if (this.initialized) return

    this.logger.log('Loading configuration from all sources...')

    // Use Promise.allSettled to handle failures gracefully
    const results = await Promise.allSettled(
      this.configSources
        .filter((source) => source.enabled)
        .map(async (source) => ({
          name: source.name,
          priority: source.priority,
          config: await source.getConfig(),
        })),
    )

    // Process results
    const configs = results
      .filter((result): result is PromiseFulfilledResult<any> => {
        if (result.status === 'rejected') {
          this.logger.warn(`Config source failed: ${result.reason.message}`)
          return false
        }
        return true
      })
      .map((result) => result.value)
      .sort((a, b) => b.priority - a.priority) // Sort by priority (highest first)

    this.logger.log(`Successfully loaded configs from: ${configs.map((c) => c.name).join(', ')}`)

    // Merge configs in priority order (last wins in lodash merge)
    const mergedRawConfig = configs.reduce((acc, { config }) => merge(acc, config), {})

    // Validate merged config with Zod schema
    try {
      this.mergedConfig = EcoSolverConfigSchema.parse(mergedRawConfig)
      this.initialized = true
      this.logger.log('Configuration validation successful')
    } catch (error) {
      this.logger.error('Configuration validation failed:', error)
      throw new Error(`Invalid eco-solver configuration: ${error.message}`)
    }
  }

  // All existing getter methods remain the same
  getRpcConfig(): EcoSolverConfigType['rpcs'] {
    this.ensureInitialized()
    return this.mergedConfig.rpcs
  }

  getAwsConfigs(): EcoSolverConfigType['aws'] {
    this.ensureInitialized()
    return this.mergedConfig.aws
  }

  // ... all other getters from existing EcoConfigService

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('EcoSolverConfigService not initialized. Call initializeConfig() first.')
    }
  }

  // Debug method for development
  getDebugInfo() {
    return {
      initialized: this.initialized,
      sourcesCount: this.configSources.length,
      sources: this.configSources.map((s) => ({
        name: s.name,
        priority: s.priority,
        enabled: s.enabled,
      })),
    }
  }
}
```

### Phase 4: Advanced Features & Testing

#### 4.1 Config Hot-Reloading

```typescript
// libs/solver-config/src/lib/services/config-hot-reload.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { EcoSolverConfigService } from './eco-solver-config.service'
import { ConfigSource } from '../interfaces/config-source.interface'

@Injectable()
export class ConfigHotReloadService {
  private readonly logger = new Logger(ConfigHotReloadService.name)
  private reloadInProgress = false

  constructor(
    private readonly configService: EcoSolverConfigService,
    private readonly configSources: ConfigSource[],
  ) {}

  async reloadConfig(): Promise<void> {
    if (this.reloadInProgress) {
      this.logger.warn('Reload already in progress, skipping')
      return
    }

    this.reloadInProgress = true

    try {
      this.logger.log('Hot-reloading configuration...')

      // Re-initialize all sources
      await this.configService.initializeConfig()

      this.logger.log('Configuration hot-reload successful')
    } catch (error) {
      this.logger.error('Configuration hot-reload failed:', error)
      throw error
    } finally {
      this.reloadInProgress = false
    }
  }
}
```

#### 4.2 Comprehensive Testing

```typescript
// libs/solver-config/src/lib/services/eco-solver-config.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { EcoSolverConfigService } from './eco-solver-config.service'
import { ConfigSource } from '../interfaces/config-source.interface'

describe('EcoSolverConfigService - Enhanced Architecture', () => {
  let service: EcoSolverConfigService

  // Mock config sources
  const mockStaticSource: ConfigSource = {
    name: 'MockStatic',
    priority: 100,
    enabled: true,
    getConfig: jest.fn().mockResolvedValue({
      server: { port: 3000 },
      cache: { ttl: 5000 },
    }),
  }

  const mockAwsSource: ConfigSource = {
    name: 'MockAws',
    priority: 50,
    enabled: true,
    getConfig: jest.fn().mockResolvedValue({
      database: { password: 'secret-from-aws' },
    }),
  }

  const mockEnvSource: ConfigSource = {
    name: 'MockEnv',
    priority: 10,
    enabled: true,
    getConfig: jest.fn().mockResolvedValue({
      server: { port: 4000 }, // Should override static config
    }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: EcoSolverConfigService,
          useFactory: () =>
            new EcoSolverConfigService([mockStaticSource, mockAwsSource, mockEnvSource]),
        },
      ],
    }).compile()

    service = module.get<EcoSolverConfigService>(EcoSolverConfigService)
  })

  it('should merge configs in priority order', async () => {
    await service.initializeConfig()

    const serverConfig = service.getServer()
    expect(serverConfig.port).toBe(4000) // Environment override wins

    const dbConfig = service.getDatabaseConfig()
    expect(dbConfig.password).toBe('secret-from-aws') // AWS provides this
  })

  it('should handle source failures gracefully', async () => {
    // Make AWS source fail
    mockAwsSource.getConfig = jest.fn().mockRejectedValue(new Error('AWS timeout'))

    await service.initializeConfig()

    // Should still work with other sources
    const serverConfig = service.getServer()
    expect(serverConfig.port).toBe(4000)
  })

  it('should work with different provider combinations', async () => {
    // Test with only static config
    const staticOnlyService = new EcoSolverConfigService([mockStaticSource])
    await staticOnlyService.initializeConfig()

    expect(staticOnlyService.getServer().port).toBe(3000)
  })
})
```

## 🎯 Migration Benefits

### 1. **Dynamic Provider System**

- Module analyzes static config and creates only needed providers
- No hardcoded AWS logic - providers created conditionally
- Easy to add new provider types (Redis, Consul, etc.)

### 2. **Service Simplicity**

- Service doesn't know about specific provider types
- Works with standardized ConfigSource[] interface
- Uses Promise.allSettled for robust error handling

### 3. **Flexible Configuration**

```typescript
// Development: Only static config
EcoSolverConfigModule.base()

// Production: Static + AWS + Environment overrides
EcoSolverConfigModule.withFullFeatures()

// Custom: Fine-grained control
EcoSolverConfigModule.forRoot({
  enableAws: true,
  enableEnvOverrides: false,
  customProviders: [MyCustomProvider],
})
```

### 4. **Error Resilience**

- Promise.allSettled handles individual provider failures
- Graceful degradation - service works even if some sources fail
- Detailed logging for troubleshooting

### 5. **Testability**

- Easy to mock ConfigSource[] for testing
- Test different provider combinations
- Validate priority-based merging logic

## 🚀 Implementation Timeline

1. **Week 1**: Create ConfigSource interface and base providers
2. **Week 2**: Build enhanced dynamic module with smart provider creation
3. **Week 3**: Implement service with Promise.allSettled pattern
4. **Week 4**: Testing, validation, and documentation

This architecture provides a robust, flexible, and maintainable configuration system that scales with the application's needs while maintaining clean separation of concerns.
