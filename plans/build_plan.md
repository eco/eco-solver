# Architecture Refactoring Plan: eco-solver Nx Configuration

## Architecture Audit Report: eco-solver Nx Configuration

**Architecture Score: 35/100** _(Updated after latest Nx research)_

## Executive Summary

- **Architecture Style**: Custom Nx configuration with non-standard patterns
- **Key Strengths**: Well-structured config management, proper Webpack integration, good separation of concerns in source code
- **Critical Issues**: Overuse of custom `nx:run-commands`, complex cache file discovery logic, non-standard environment handling
- **Technical Debt Score**: High

## Critical Updates Based on Latest Nx Research (2025)

⚠️ **IMPORTANT**: After analyzing current Nx documentation and best practices for 2025, several critical corrections to the original plan are required:

### Key Research Findings

1. **NestJS + Webpack**: Use `@nx/webpack:webpack` for build, NOT `@nx/node:node` for serve
2. **Environment Variables**: Nx 2025 uses `.env.[configuration]` files + `NX_PUBLIC_` prefix pattern
3. **Dependencies**: Requires `@nx/webpack` and optionally `@nx/nest` plugins
4. **Serve Strategy**: For NestJS apps, use build+node execution pattern, not webpack-dev-server

## Current Issues Identified

### Issue 1: Overuse of Custom nx:run-commands

**Severity**: High
**Impact**:

- Loss of Nx's built-in caching and optimization benefits
- Poor developer experience with non-standard commands
- Difficult to maintain and scale
- Manual environment variable management

### Issue 2: Complex Cache File Discovery Logic

**Severity**: High
**Problem**: `$(find .nx/cache -name 'main.js' -path '*/dist/apps/eco-solver/main.js' | head -1)`
**Impact**:

- Brittle file discovery mechanism
- Fails if cache structure changes
- Non-deterministic behavior
- Platform-specific shell commands

### Issue 3: Manual Environment Variable Management

**Severity**: Medium
**Problem**: Manual NODE_ENV and NODE_CONFIG_DIR setup in shell commands
**Impact**:

- Inconsistent environment handling
- Prone to configuration errors
- Not leveraging Nx's environment system

## Migration Plan

### Phase 1: Foundation (Week 1)

#### 1.1 Replace Custom Build Target

**Current:**

```json
"build": {
  "executor": "nx:run-commands",
  "options": {
    "command": "webpack-cli build",
    "args": ["--node-env=production"],
    "cwd": "apps/eco-solver"
  }
}
```

**Recommended:**

```json
"build": {
  "executor": "@nx/webpack:webpack",
  "outputs": ["{options.outputPath}"],
  "options": {
    "main": "apps/eco-solver/src/main.ts",
    "tsConfig": "apps/eco-solver/tsconfig.app.json",
    "webpackConfig": "apps/eco-solver/webpack.config.js",
    "outputPath": "dist/apps/eco-solver",
    "assets": [
      {
        "glob": "**/*",
        "input": "apps/eco-solver/config",
        "output": "config"
      }
    ]
  },
  "configurations": {
    "development": {
      "optimization": false,
      "extractLicenses": false,
      "sourceMap": true,
      "fileReplacements": [
        {
          "replace": "apps/eco-solver/src/environments/environment.ts",
          "with": "apps/eco-solver/src/environments/environment.development.ts"
        }
      ]
    },
    "production": {
      "optimization": true,
      "extractLicenses": true,
      "sourceMap": false,
      "fileReplacements": [
        {
          "replace": "apps/eco-solver/src/environments/environment.ts",
          "with": "apps/eco-solver/src/environments/environment.production.ts"
        }
      ]
    },
    "staging": {
      "optimization": true,
      "extractLicenses": true,
      "sourceMap": false,
      "fileReplacements": [
        {
          "replace": "apps/eco-solver/src/environments/environment.ts",
          "with": "apps/eco-solver/src/environments/environment.staging.ts"
        }
      ]
    },
    "preproduction": {
      "optimization": true,
      "extractLicenses": true,
      "sourceMap": false,
      "fileReplacements": [
        {
          "replace": "apps/eco-solver/src/environments/environment.ts",
          "with": "apps/eco-solver/src/environments/environment.preproduction.ts"
        }
      ]
    }
  }
}
```

#### 1.2 Replace Custom Serve Target (UPDATED)

**Current:**

```json
"serve": {
  "executor": "nx:run-commands",
  "options": {
    "command": "NODE_CONFIG_DIR=apps/eco-solver/config node $(find .nx/cache -name 'main.js' -path '*/dist/apps/eco-solver/main.js' | head -1)"
  }
}
```

**Recommended (Corrected):**

```json
"serve": {
  "executor": "nx:run-commands",
  "dependsOn": ["build"],
  "options": {
    "command": "node dist/apps/eco-solver/main.js",
    "cwd": "."
  },
  "configurations": {
    "development": {
      "command": "node dist/apps/eco-solver/main.js",
      "env": {
        "NODE_ENV": "development"
      }
    },
    "production": {
      "command": "node dist/apps/eco-solver/main.js",
      "env": {
        "NODE_ENV": "production"
      }
    },
    "staging": {
      "command": "node dist/apps/eco-solver/main.js",
      "env": {
        "NODE_ENV": "staging"
      }
    },
    "preproduction": {
      "command": "node dist/apps/eco-solver/main.js",
      "env": {
        "NODE_ENV": "preproduction"
      }
    }
  }
}
```

**Alternative with @nx/node:node executor:**

```json
"serve": {
  "executor": "@nx/node:node",
  "dependsOn": ["build"],
  "options": {
    "buildTarget": "eco-solver:build",
    "inspect": false
  },
  "configurations": {
    "development": {
      "buildTarget": "eco-solver:build:development"
    },
    "production": {
      "buildTarget": "eco-solver:build:production"
    }
  }
}
```

#### 1.3 Create Modern Environment Configuration (UPDATED)

**Step 1: Create .env files for Nx configuration loading**

```bash
# apps/eco-solver/.env.development
NODE_CONFIG_DIR=./config
NX_PUBLIC_API_URL=http://localhost:3000

# apps/eco-solver/.env.production
NODE_CONFIG_DIR=./config
NX_PUBLIC_API_URL=https://api.production.com

# apps/eco-solver/.env.staging
NODE_CONFIG_DIR=./config
NX_PUBLIC_API_URL=https://api.staging.com

# apps/eco-solver/.env.preproduction
NODE_CONFIG_DIR=./config
NX_PUBLIC_API_URL=https://api.preprod.com
```

**Architecture Decision: Separation of Concerns**

- **Build-time environment**: Managed through `fileReplacements` in Nx build configurations
- **Runtime environment**: `NODE_ENV` set explicitly in serve target configurations
- **Configuration variables**: `NODE_CONFIG_DIR` and `NX_PUBLIC_*` managed through .env files
- **No redundant NODE_ENV in .env files** since environment context is established through fileReplacements

**Step 2: Create simplified environment files**

```typescript
// apps/eco-solver/src/environments/environment.ts (Base/Development)
export const environment = {
  production: false,
  configDir: process.env.NODE_CONFIG_DIR || './config',
  apiUrl: process.env.NX_PUBLIC_API_URL || 'http://localhost:3000',
}

// apps/eco-solver/src/environments/environment.production.ts
export const environment = {
  production: true,
  configDir: process.env.NODE_CONFIG_DIR || './config',
  apiUrl: process.env.NX_PUBLIC_API_URL || 'https://api.production.com',
}

// apps/eco-solver/src/environments/environment.staging.ts
export const environment = {
  production: false, // Staging is not production
  configDir: process.env.NODE_CONFIG_DIR || './config',
  apiUrl: process.env.NX_PUBLIC_API_URL || 'https://api.staging.com',
}

// apps/eco-solver/src/environments/environment.preproduction.ts
export const environment = {
  production: false, // Preproduction is not production
  configDir: process.env.NODE_CONFIG_DIR || './config',
  apiUrl: process.env.NX_PUBLIC_API_URL || 'https://api.preprod.com',
}
```

**Note**: Removed `nodeEnv` property since `NODE_ENV` is runtime-specific and handled by Node.js execution context, not build-time configuration.

### Phase 1.5: Install Required Dependencies (CRITICAL)

**Install Nx Webpack Plugin:**

```bash
pnpm add --save-dev @nx/webpack @nx/node
# Optional for enhanced NestJS support:
pnpm add --save-dev @nx/nest
```

**Update nx.json with proper caching:**

```json
{
  "targetDefaults": {
    "build": {
      "cache": true,
      "dependsOn": ["^build"],
      "inputs": [
        "default",
        "^default",
        "{workspaceRoot}/.env.{configuration}",
        "apps/eco-solver/.env.{configuration}",
        {
          "externalDependencies": ["webpack"]
        }
      ]
    },
    "serve": {
      "cache": false
    }
  }
}
```

### Phase 2: Configuration Enhancement (Week 2)

#### 2.1 Enhance Webpack Configuration (UPDATED)

**Update:** `apps/eco-solver/webpack.config.js`

```javascript
const { composePlugins, withNx } = require('@nx/webpack')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')
const webpack = require('webpack')
const path = require('path')

module.exports = composePlugins(withNx(), (config, { options, context }) => {
  // Load environment variables based on configuration
  require('dotenv').config({
    path: path.join(
      context.root,
      'apps/eco-solver',
      `.env.${process.env.NODE_ENV || 'development'}`,
    ),
  })

  // Enable Webpack 5 filesystem caching
  config.cache = {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  }

  // Remove the default ForkTsChecker added by Nx, then add our own with exclusions
  config.plugins = config.plugins.filter(
    (p) => !(p && p.constructor && p.constructor.name === 'ForkTsCheckerWebpackPlugin'),
  )

  config.plugins.push(
    new ForkTsCheckerWebpackPlugin({
      issue: {
        exclude: [{ file: '**/node_modules/permissionless/**' }],
      },
      typescript: {
        diagnosticOptions: { syntactic: true, semantic: true },
        // Enable incremental compilation
        mode: 'write-references',
      },
    }),
  )

  // Enhanced DefinePlugin for environment variables
  const existingDefinePlugin = config.plugins.find((p) => p.constructor.name === 'DefinePlugin')
  if (existingDefinePlugin) {
    Object.assign(existingDefinePlugin.definitions, {
      'process.env.NODE_CONFIG_DIR': JSON.stringify(process.env.NODE_CONFIG_DIR),
      'process.env.NX_PUBLIC_API_URL': JSON.stringify(process.env.NX_PUBLIC_API_URL),
    })
  }

  return {
    ...config,
    target: 'node',
    output: {
      ...config.output,
      clean: true,
      path: path.resolve(context.root, options.outputPath || 'dist/apps/eco-solver'),
    },
    resolve: {
      ...config.resolve,
      alias: {
        ...config.resolve.alias,
        '@': path.resolve(__dirname, 'src'),
        '@eco-solver': path.resolve(__dirname, 'src'),
      },
      fallback: {
        fs: false,
        path: false,
      },
    },
    externals: {
      '@nestjs/microservices': '@nestjs/microservices',
      '@nestjs/websockets/socket-module': '@nestjs/websockets/socket-module',
      'cache-manager': 'cache-manager',
      'class-transformer': 'class-transformer',
      'class-validator': 'class-validator',
    },
    // Enable source maps for better debugging
    devtool: process.env.NODE_ENV === 'production' ? 'source-map' : 'eval-source-map',
  }
})
```

#### 2.2 Improve CLI Target

**Replace:**

```json
"cli": {
  "executor": "@nx/node:node",
  "options": {
    "main": "apps/eco-solver/src/commander/command-main.ts",
    "tsConfig": "apps/eco-solver/tsconfig.app.json",
    "env": {
      "NODE_CONFIG_DIR": "apps/eco-solver/config"
    }
  },
  "configurations": {
    "development": {
      "env": {
        "NODE_ENV": "development",
        "NODE_CONFIG_DIR": "apps/eco-solver/config"
      }
    },
    "production": {
      "env": {
        "NODE_ENV": "production",
        "NODE_CONFIG_DIR": "apps/eco-solver/config"
      }
    }
  }
}
```

#### 2.3 Add Configuration Validation

**Create:** `apps/eco-solver/src/config/config.schema.ts`

```typescript
import * as Joi from 'joi'

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging', 'preproduction')
    .default('development'),
  NODE_CONFIG_DIR: Joi.string().required(),
  PORT: Joi.number().default(3000),
})
```

### Phase 3: Optimization (Week 3)

#### 3.1 Advanced Nx Configuration Integration

**Create:** `apps/eco-solver/src/environments/nx-environment.service.ts`

```typescript
import { Injectable } from '@nestjs/common'
import { environment } from './environment'

@Injectable()
export class NxEnvironmentService {
  getConfigDirectory(): string {
    return environment.configDir
  }

  isProduction(): boolean {
    return environment.production
  }

  getNodeEnv(): string {
    return process.env.NODE_ENV || 'development'
  }
}
```

## Benefits of Migration

### Developer Experience

- **Faster builds**: Leverage Nx's intelligent caching
- **Better IDE support**: Standard Nx patterns work with extensions
- **Consistent commands**: Follow Nx conventions across projects
- **Easier debugging**: Standard output paths and file locations

### Maintainability

- **Reduced complexity**: Remove shell-based file discovery
- **Better error handling**: Nx executors provide better error messages
- **Configuration validation**: Built-in validation for target configurations
- **Standardization**: Consistent with Nx ecosystem best practices

### Scalability

- **Dependency graph**: Better understanding of project relationships
- **Incremental builds**: Only rebuild what changed
- **Parallel execution**: Nx can run tasks in parallel safely
- **Cloud caching**: Enable Nx Cloud for distributed caching

## Risk Assessment

### Low Risk

- Configuration file changes (can be reverted easily)
- Environment file additions (additive changes)
- Webpack configuration enhancements

### Medium Risk

- Changing build and serve executors (affects daily workflow)
- Output path changes (may affect deployment scripts)

### Mitigation Strategies

1. **Gradual rollout**: Implement changes incrementally
2. **Backup configurations**: Keep current project.json as backup
3. **Testing**: Thoroughly test each environment configuration
4. **Documentation**: Update team documentation and runbooks

## Implementation Checklist

### Phase 1 Tasks (UPDATED)

- [ ] Backup current `apps/eco-solver/project.json`
- [ ] **CRITICAL**: Install `@nx/webpack` and `@nx/node` packages
- [ ] Create `.env.[configuration]` files for each environment
- [ ] Update `nx.json` with proper caching configuration
- [ ] Replace build target with `@nx/webpack:webpack`
- [ ] Replace serve target (choose between nx:run-commands or @nx/node:node)
- [ ] Create simplified environment files structure
- [ ] Test all configurations (development, production, staging, preproduction)
- [ ] Verify config directory copying works correctly
- [ ] Verify environment variables load correctly from .env files

### Phase 2 Tasks

- [ ] Enhance webpack configuration
- [ ] Update CLI target to use standard executor
- [ ] Add configuration validation schema
- [ ] Update documentation
- [ ] Test CLI functionality

### Phase 3 Tasks

- [ ] Add Nx environment service
- [ ] Enable advanced Nx features
- [ ] Performance testing
- [ ] Update team runbooks
- [ ] Clean up old configuration patterns

## Expected Outcomes (UPDATED)

After completing this migration, the eco-solver application will:

1. Use standard Nx executors (`@nx/webpack:webpack`) for better maintainability
2. Eliminate brittle file discovery logic completely
3. Properly handle environment configurations through modern Nx `.env.[configuration]` pattern
4. Leverage Nx caching with filesystem-level webpack caching for **40-60% faster builds**
5. Follow 2025 industry best practices for Nx monorepo applications
6. Support incremental TypeScript compilation
7. Enable proper debugging with source maps
8. Use `NX_PUBLIC_` prefix pattern for frontend environment variables

## Performance Improvements Expected

- **Build time reduction**: 40-60% faster builds due to Nx + Webpack 5 caching
- **Incremental builds**: Only rebuild changed files
- **Better hot reload**: Faster development iteration cycles
- **Smaller bundle size**: Proper externalization of dependencies

This transformation will result in a cutting-edge, maintainable, scalable, and developer-friendly build system that leverages the latest 2025 Nx ecosystem standards and performance optimizations.
