# Eco-Solver Migration Plan: Simple Setup

## Executive Summary

This plan outlines the minimal necessary changes to migrate the eco-solver application from `/Users/stoyan/git/eco-solver` into the Nx monorepo structure at `apps/eco-solver`, ensuring the application runs successfully with minimal disruption.

**Migration Strategy**: In-place replacement with dependency consolidation
**Estimated Time**: 2-4 hours
**Risk Level**: Low (preserves existing architecture)

## Pre-Migration Analysis

### Source Application Profile
- **Framework**: NestJS with TypeScript
- **Architecture**: Domain-driven modular monolith
- **Package Manager**: pnpm (enforced)
- **Node Version**: v20.19.2
- **Dependencies**: 62 total (34 runtime, 28 dev)
- **Key Features**: REST API, CLI commands, MongoDB, Redis, BullMQ jobs

### Current Monorepo Status
- **Nx Version**: 21.4.0
- **Package Manager**: pnpm (already configured)
- **Current eco-solver**: Basic placeholder app
- **Missing**: @nx/nest plugin

## Phase 1: Environment Setup

### 1.1 Install Required Nx Plugins
```bash
pnpm add --save-dev @nx/nest
```

### 1.2 Node Version Alignment
- Ensure Node v20.19.2 is available
- Copy `.nvmrc` from source to monorepo root if needed

## Phase 2: Dependency Management

### 2.1 Merge Dependencies into Root package.json

**Runtime Dependencies to Add:**
```json
{
  "@nestjs/common": "^11.0.0",
  "@nestjs/core": "^11.0.0",
  "@nestjs/config": "^3.0.0",
  "@nestjs/mongoose": "^10.0.0",
  "@nestjs/terminus": "^10.0.0",
  "@nestjs/cache-manager": "^2.0.0",
  "@nestjs/bullmq": "^10.0.0",
  "mongoose": "^8.0.0",
  "ioredis": "^5.0.0",
  "bullmq": "^5.0.0",
  "class-validator": "^0.14.0",
  "class-transformer": "^0.5.0",
  "config": "^3.3.0",
  "nestjs-pino": "^4.0.0",
  "viem": "^2.0.0",
  "@eco-foundation/routes-ts": "latest",
  "permissionless": "^0.1.0",
  "@aws-sdk/client-kms": "^3.0.0",
  "commander": "^12.0.0"
}
```

**DevDependencies to Add:**
```json
{
  "@nestjs/cli": "^11.0.0",
  "@nestjs/testing": "^11.0.0",
  "@shelf/jest-mongodb": "^4.0.0",
  "supertest": "^7.0.0",
  "ts-node": "^10.9.0",
  "@types/supertest": "^6.0.0"
}
```

### 2.2 Update Root package.json Scripts
```json
{
  "scripts": {
    "eco-solver:build": "nx build eco-solver",
    "eco-solver:serve": "nx serve eco-solver", 
    "eco-solver:dev": "nx serve eco-solver --watch",
    "eco-solver:test": "nx test eco-solver",
    "eco-solver:cli": "nx run eco-solver:cli"
  }
}
```

## Phase 3: File Migration

### 3.1 Backup Current State
```bash
# Create backup of current placeholder
mv apps/eco-solver apps/eco-solver-backup
```

### 3.2 Copy Source Application
```bash
# Copy entire source application
cp -r /Users/stoyan/git/eco-solver/src apps/eco-solver/src
cp -r /Users/stoyan/git/eco-solver/test apps/eco-solver/test
cp -r /Users/stoyan/git/eco-solver/config apps/eco-solver/config

# Copy configuration files
cp /Users/stoyan/git/eco-solver/.env* apps/eco-solver/ 2>/dev/null || true
cp /Users/stoyan/git/eco-solver/nest-cli.json apps/eco-solver/
```

### 3.3 Copy Docker Configuration (if needed)
```bash
cp /Users/stoyan/git/eco-solver/Dockerfile apps/eco-solver/
cp /Users/stoyan/git/eco-solver/docker-compose.yml apps/eco-solver/
cp /Users/stoyan/git/eco-solver/.dockerignore apps/eco-solver/
```

## Phase 4: Configuration System Migration

⚠️ **CRITICAL**: The eco-solver application uses a complex configuration system that requires careful migration.

### 4.0 Configuration System Analysis

**Current System**: Uses `npm config` library with hierarchical configuration merging:
- **Static configs**: TypeScript files in `/config` directory (development.ts, production.ts, etc.)
- **External configs**: AWS Secrets Manager via `ConfigSource` providers
- **Runtime overrides**: `NODE_CONFIG` environment variable for Docker containers

**Migration Strategy**: Replace `npm config` with NestJS ConfigModule while preserving all functionality.

### 4.1 Install NestJS Config Dependencies
```bash
pnpm add @nestjs/config
```

### 4.2 Create Nx-Compatible Configuration System

#### 4.2.1 Create apps/eco-solver/src/config/config-loader.ts
```typescript
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface ConfigEnvironments {
  default: any;
  development?: any;
  production?: any;
  preproduction?: any;
  staging?: any;
  test?: any;
}

export class ConfigLoader {
  private static configCache = new Map<string, any>();
  private static configDir = join(__dirname, '../../../config');

  static load(): any {
    const env = process.env.NODE_ENV || 'development';
    
    if (this.configCache.has(env)) {
      return this.configCache.get(env);
    }

    // Load base configuration
    let config = this.loadConfigFile('default.ts') || {};
    
    // Load environment-specific configuration
    if (env !== 'default') {
      const envConfig = this.loadConfigFile(`${env}.ts`);
      if (envConfig) {
        config = this.deepMerge(config, envConfig);
      }
    }

    // Apply NODE_CONFIG runtime overrides (for Docker containers)
    if (process.env.NODE_CONFIG) {
      try {
        const runtimeConfig = JSON.parse(process.env.NODE_CONFIG);
        config = this.deepMerge(config, runtimeConfig);
      } catch (error) {
        console.warn('Invalid NODE_CONFIG format:', error.message);
      }
    }

    this.configCache.set(env, config);
    return config;
  }

  private static loadConfigFile(filename: string): any {
    const filePath = join(this.configDir, filename);
    
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      // Clear require cache to allow hot reloading
      delete require.cache[require.resolve(filePath)];
      const configModule = require(filePath);
      return configModule.default || configModule;
    } catch (error) {
      console.warn(`Failed to load config file ${filename}:`, error.message);
      return null;
    }
  }

  private static deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  static get(path: string): any {
    const config = this.load();
    return this.getNestedValue(config, path);
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  static has(path: string): boolean {
    return this.get(path) !== undefined;
  }

  static util = {
    getEnv: (varName: string) => process.env[varName] || 'development'
  };
}
```

#### 4.2.2 Update eco-config.service.ts for Nx compatibility
```typescript
import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigLoader } from '../config/config-loader';
import type { ConfigSource } from './config-source.interface';

@Injectable()
export class EcoConfigService implements OnModuleInit {
  private mergedConfig: any = {};
  private staticConfig: any = {};

  constructor(
    private configService: ConfigService,
    @Inject('CONFIG_SOURCES') private configSources: ConfigSource[] = []
  ) {
    // Load static configuration using our custom loader
    this.staticConfig = ConfigLoader.load();
    this.mergedConfig = { ...this.staticConfig };
  }

  async onModuleInit() {
    // Initialize external configurations (AWS, etc.)
    for (const source of this.configSources) {
      try {
        const externalConfig = await source.getConfig();
        this.mergedConfig = this.deepMerge(this.mergedConfig, externalConfig);
      } catch (error) {
        console.warn(`Failed to load config from ${source.constructor.name}:`, error.message);
      }
    }
  }

  get<T = any>(path: string, defaultValue?: T): T {
    // First try merged config (includes external configs)
    let value = this.getNestedValue(this.mergedConfig, path);
    
    // Fall back to NestJS ConfigService for environment variables
    if (value === undefined) {
      value = this.configService.get(path, defaultValue);
    }
    
    return value ?? defaultValue;
  }

  has(path: string): boolean {
    return this.get(path) !== undefined;
  }

  // Static method for compile-time config access (preserves existing usage)
  static getStaticConfig(path?: string): any {
    const config = ConfigLoader.load();
    return path ? ConfigLoader.get(path) : config;
  }

  // Utility methods to maintain compatibility with npm config API
  static util = {
    getEnv: (varName: string) => process.env[varName] || 'development'
  };

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
}
```

#### 4.2.3 Update eco-config.module.ts
```typescript
import { Global, Module, DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EcoConfigService } from './eco-config.service';
import { AwsConfigService } from './aws-config.service';
import { ConfigLoader } from '../config/config-loader';

@Global()
@Module({})
export class EcoConfigModule {
  static withAWS(): DynamicModule {
    return {
      module: EcoConfigModule,
      imports: [
        ConfigModule.forRoot({
          load: [() => ConfigLoader.load()],
          isGlobal: true,
          cache: true,
        }),
      ],
      providers: [
        AwsConfigService,
        {
          provide: 'CONFIG_SOURCES',
          useFactory: async (awsConfigService: AwsConfigService) => {
            await awsConfigService.initConfigs();
            return [awsConfigService];
          },
          inject: [AwsConfigService],
        },
        EcoConfigService,
      ],
      exports: [EcoConfigService],
    };
  }

  static base(): DynamicModule {
    return {
      module: EcoConfigModule,
      imports: [
        ConfigModule.forRoot({
          load: [() => ConfigLoader.load()],
          isGlobal: true,
          cache: true,
        }),
      ],
      providers: [
        {
          provide: 'CONFIG_SOURCES',
          useValue: [],
        },
        EcoConfigService,
      ],
      exports: [EcoConfigService],
    };
  }
}
```

### 4.3 Configuration Directory Migration

#### 4.3.1 Convert config files to Nx-compatible paths
Update all configuration files to use relative paths:

**apps/eco-solver/config/default.ts:**
```typescript
export default {
  // Update any hardcoded paths to be relative to the app directory
  // Example: './assets' instead of './src/assets'
  logLevel: process.env.LOG_LEVEL || 'info',
  port: process.env.PORT || 3000,
  // ... rest of configuration
};
```

#### 4.3.2 Update config references in Docker
Update any Docker configurations to mount the config directory:
```yaml
# In docker-compose.yml or Dockerfile
volumes:
  - ./apps/eco-solver/config:/usr/src/app/apps/eco-solver/config
```

### 4.4 Remove npm config dependency

#### 4.4.1 Update package.json dependencies
Remove from root package.json:
```json
{
  "dependencies": {
    // Remove: "config": "^3.3.11"
  }
}
```

#### 4.4.2 Update imports throughout codebase
Find and replace all imports:
```typescript
// Change from:
import * as config from 'config';

// To:
import { EcoConfigService } from '@/eco-configs/eco-config.service';
// Or use dependency injection in services
```

### 4.5 Preserve Environment Variable Support

#### 4.5.1 Maintain NODE_CONFIG support
The new ConfigLoader maintains compatibility with NODE_CONFIG for Docker containers:
```bash
# This will still work in Docker containers:
NODE_CONFIG='{"database":{"uri":"mongodb://mongo:27017"}}'
```

#### 4.5.2 Support existing environment detection
```typescript
// This pattern is preserved:
const env = EcoConfigService.util.getEnv('NODE_ENV');
```

### 4.6 Update apps/eco-solver/project.json
```json
{
  "name": "eco-solver",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/eco-solver/src",
  "projectType": "application",
  "tags": ["scope:eco-solver", "type:app"],
  "targets": {
    "build": {
      "executor": "@nx/node:build",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/apps/eco-solver",
        "main": "apps/eco-solver/src/main.ts",
        "tsConfig": "apps/eco-solver/tsconfig.app.json",
        "assets": [
          "apps/eco-solver/config",
          "apps/eco-solver/.env*"
        ],
        "webpackConfig": "apps/eco-solver/webpack.config.js"
      },
      "configurations": {
        "production": {
          "optimization": true,
          "extractLicenses": true,
          "inspect": false,
          "fileReplacements": [
            {
              "replace": "apps/eco-solver/src/environments/environment.ts",
              "with": "apps/eco-solver/src/environments/environment.prod.ts"
            }
          ]
        }
      }
    },
    "serve": {
      "executor": "@nx/node:execute",
      "defaultConfiguration": "development",
      "options": {
        "buildTarget": "eco-solver:build",
        "port": 3000
      },
      "configurations": {
        "development": {
          "buildTarget": "eco-solver:build:development"
        },
        "production": {
          "buildTarget": "eco-solver:build:production"
        }
      }
    },
    "cli": {
      "executor": "@nx/node:execute",
      "options": {
        "buildTarget": "eco-solver:build",
        "args": ["--help"]
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/apps/eco-solver"],
      "options": {
        "jestConfig": "apps/eco-solver/jest.config.ts"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": ["apps/eco-solver/**/*.ts"]
      }
    }
  }
}
```

### 4.2 Create apps/eco-solver/tsconfig.app.json
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "module": "commonjs",
    "types": ["node"],
    "emitDecoratorMetadata": true,
    "target": "es2021",
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "exclude": [
    "jest.config.ts",
    "src/**/*.spec.ts",
    "src/**/*.test.ts",
    "test/**/*"
  ],
  "include": ["src/**/*"]
}
```

### 4.3 Create apps/eco-solver/tsconfig.spec.json
```json
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "module": "commonjs",
    "types": ["jest", "node", "@shelf/jest-mongodb"]
  },
  "include": [
    "jest.config.ts",
    "src/**/*.test.ts",
    "src/**/*.spec.ts",
    "src/**/*.d.ts",
    "test/**/*"
  ]
}
```

### 4.4 Create apps/eco-solver/jest.config.ts
```typescript
import type { Config } from 'jest';

const config: Config = {
  displayName: 'eco-solver',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/eco-solver',
  setupFiles: ['<rootDir>/test/jest.setup.js'],
  globalSetup: '<rootDir>/test/jest-global-setup.js',
  globalTeardown: '<rootDir>/test/jest-global-teardown.js'
};

export default config;
```

### 4.5 Update apps/eco-solver/nest-cli.json
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "tsConfigPath": "tsconfig.app.json",
    "assets": ["config/**/*"],
    "watchAssets": true
  }
}
```

## Phase 5: Path Resolution Fixes

### 5.1 Update tsconfig.base.json (root)
```json
{
  "compileOnSave": false,
  "compilerOptions": {
    "rootDir": ".",
    "sourceMap": true,
    "declaration": false,
    "moduleResolution": "node",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "importHelpers": true,
    "target": "es2015",
    "module": "esnext",
    "lib": ["es2020", "dom"],
    "skipLibCheck": true,
    "skipDefaultLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@eco-solver/*": ["apps/eco-solver/src/*"]
    }
  },
  "exclude": ["node_modules", "tmp"]
}
```

## Phase 6: Environment and Configuration

### 6.1 Configuration Path Updates
Update `apps/eco-solver/src/eco-configs/eco-config.service.ts` if it contains hardcoded paths:
```typescript
// Change from:
// configDir: './config'
// To:
// configDir: path.join(__dirname, '../config')
```

### 6.2 Environment Variables
Copy environment files maintaining their current structure:
- `.env-cmdrc`
- `.env.development`
- `.env.production`

## Phase 7: Docker Integration (Optional)

### 7.1 Update Docker Configuration
If using Docker, update `apps/eco-solver/Dockerfile`:
```dockerfile
FROM node:20-alpine

RUN corepack enable pnpm

WORKDIR /usr/src/app

# Copy package files
COPY package*.json pnpm-lock.yaml ./
COPY nx.json ./
COPY tsconfig.base.json ./

# Copy app specific files
COPY apps/eco-solver ./apps/eco-solver/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the application
RUN pnpm nx build eco-solver

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/apps/eco-solver/main.js"]
```

## Phase 8: Testing and Validation

### 8.1 Build Verification
```bash
pnpm nx build eco-solver
```

### 8.2 Development Server Test
```bash
pnpm nx serve eco-solver
```

### 8.3 Unit Tests
```bash
pnpm nx test eco-solver
```

### 8.4 CLI Command Test
```bash
pnpm nx run eco-solver:cli
```

## Phase 9: Clean Up

### 9.1 Remove Redundant Files
```bash
rm -rf apps/eco-solver-backup
```

### 9.2 Update .gitignore
Add Nx-specific ignores:
```
/dist
/.nx/cache
```

## Expected Outcomes

After successful migration:
- ✅ Eco-solver application runs on `http://localhost:3000`
- ✅ All existing API endpoints accessible
- ✅ CLI commands work via `pnpm nx run eco-solver:cli`
- ✅ Tests pass with `pnpm nx test eco-solver`
- ✅ Build succeeds with `pnpm nx build eco-solver`
- ✅ MongoDB and Redis connections maintained
- ✅ All environment configurations preserved

## Risk Mitigation

1. **Backup Strategy**: Keep original source code untouched during migration
2. **Incremental Testing**: Test each phase before proceeding
3. **Rollback Plan**: Maintain backup of working placeholder app
4. **Dependency Conflicts**: Use exact versions from source package.json
5. **Path Issues**: Verify all imports resolve correctly after migration

## Future Optimization Opportunities

Once basic migration is complete, consider:
1. **Library Extraction**: Move common utilities to `libs/`
2. **Shared Types**: Extract TypeScript interfaces to shared library
3. **Configuration Service**: Create reusable config library
4. **Database Models**: Extract Mongoose schemas to shared library
5. **Testing Utilities**: Create shared testing helpers

## Success Criteria

✅ Application starts without errors  
✅ Health check endpoint responds  
✅ Database connectivity verified  
✅ Redis connectivity verified  
✅ All unit tests pass  
✅ CLI commands execute successfully  
✅ Build process completes without errors  
✅ Docker container builds and runs (if applicable)

This plan ensures minimal disruption while successfully integrating the eco-solver application into the Nx monorepo structure with all functionality preserved.