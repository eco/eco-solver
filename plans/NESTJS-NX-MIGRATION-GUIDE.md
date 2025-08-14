# NestJS to Nx Monorepo Migration Guide

This guide provides a comprehensive overview of how to migrate an existing NestJS project to an Nx monorepo, based on practical implementation and research of Nx's NestJS capabilities.

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Migration Strategy](#migration-strategy)
4. [Step-by-Step Migration](#step-by-step-migration)
5. [Configuration Deep Dive](#configuration-deep-dive)
6. [Best Practices](#best-practices)
7. [Common Issues and Solutions](#common-issues-and-solutions)

## Overview

Nx is a smart, fast build system that provides advanced tooling for monorepo development. When combined with NestJS, it offers:

- **Smart Builds**: Only builds what's affected by your changes
- **Caching**: Dramatically speeds up builds and tests
- **Code Generation**: Scaffolds NestJS components with generators
- **Dependency Management**: Manages inter-library dependencies
- **Task Orchestration**: Runs tasks across multiple projects efficiently

## Prerequisites

- Node.js 18+ and npm/pnpm/yarn
- Existing NestJS project
- Basic understanding of TypeScript and NestJS

## Migration Strategy

### Approach Options

1. **Fresh Start Migration** (Recommended for complex projects)
   - Create new Nx workspace with NestJS preset
   - Migrate code incrementally
   - Preserve git history via `nx import`

2. **In-Place Migration**
   - Add Nx to existing project
   - Gradually adopt Nx features

3. **Workspace Integration**
   - Add existing project to existing Nx workspace

## Step-by-Step Migration

### Option 1: Fresh Start Migration

#### 1. Create New Nx Workspace

```bash
# Create workspace with NestJS preset
npx create-nx-workspace@latest my-workspace --preset=nest --packageManager=pnpm

# Or create empty workspace and add NestJS later
npx create-nx-workspace@latest my-workspace --preset=npm --packageManager=pnpm
cd my-workspace
pnpm add -D @nx/nest
```

#### 2. Generate NestJS Application

```bash
# Generate main application
nx g @nx/nest:app api

# Or if you need specific configuration
nx g @nx/nest:app api --frontendProject=web --strict
```

#### 3. Create Shared Libraries

```bash
# Generate shared libraries
nx g @nx/nest:lib shared-lib
nx g @nx/nest:lib domain-core
nx g @nx/nest:lib infrastructure-database
```

#### 4. Migrate Existing Code

- Copy your existing source files to the appropriate applications/libraries
- Update import paths to use the new structure
- Update module imports to include shared libraries

### Option 2: In-Place Migration

#### 1. Add Nx to Existing Project

```bash
# In your existing NestJS project root
npx nx@latest init

# Add NestJS plugin
npm install -D @nx/nest
```

#### 2. Configure Project Structure

Create `project.json` for your application:

```json
{
  "name": "api",
  "$schema": "./node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "src",
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "options": {
        "command": "webpack-cli build",
        "args": ["--node-env=production"]
      },
      "configurations": {
        "development": {
          "args": ["--node-env=development"]
        }
      }
    },
    "serve": {
      "continuous": true,
      "executor": "@nx/js:node",
      "defaultConfiguration": "development",
      "dependsOn": ["build"],
      "options": {
        "buildTarget": "api:build",
        "runBuildTargetDependencies": false
      },
      "configurations": {
        "development": {
          "buildTarget": "api:build:development"
        },
        "production": {
          "buildTarget": "api:build:production"
        }
      }
    }
  },
  "tags": []
}
```

## Configuration Deep Dive

### 1. Workspace Configuration (`nx.json`)

```json
{
  "extends": "nx/presets/npm.json",
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "plugins": [
    {
      "plugin": "@nx/webpack/plugin",
      "options": {
        "buildTargetName": "build",
        "serveTargetName": "serve",
        "previewTargetName": "preview"
      }
    }
  ]
}
```

### 2. TypeScript Path Mapping (`tsconfig.base.json`)

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
      "@my-workspace/shared-lib": ["libs/shared-lib/src/index.ts"],
      "@my-workspace/domain-core": ["libs/domain-core/src/index.ts"]
    }
  },
  "exclude": ["node_modules", "tmp"]
}
```

### 3. Application Configuration

For applications, create `project.json` with:
- Build target using webpack
- Serve target with hot reload
- Test and lint targets
- Dependency graph definition

### 4. Library Configuration

For libraries, simpler `project.json`:

```json
{
  "name": "shared-lib",
  "$schema": "../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/shared-lib/src",
  "projectType": "library",
  "tags": ["scope:shared"],
  "targets": {}
}
```

### 5. Webpack Configuration

Nx generates `webpack.config.js` for NestJS apps:

```javascript
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../dist/api'),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
    }),
  ],
};
```

## Best Practices

### 1. Library Organization

```
libs/
├── domain/           # Business logic
│   ├── user-core/
│   └── order-core/
├── shared/           # Common utilities
│   ├── utils/
│   └── types/
├── infrastructure/   # External dependencies
│   ├── database/
│   └── config/
└── ui/              # Frontend libraries (if applicable)
```

### 2. Dependency Rules

Use tags in `project.json` and enforce rules in `nx.json`:

```json
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  },
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": ["default", "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)"]
  }
}
```

### 3. Import Strategy

- Use barrel exports (`index.ts`) for clean imports
- Leverage TypeScript path mapping
- Follow consistent naming conventions

```typescript
// libs/shared-lib/src/index.ts
export * from './lib/shared-lib.module';
export * from './lib/shared.service';

// In application
import { SharedLibModule, SharedService } from '@my-workspace/shared-lib';
```

### 4. Module Integration

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { SharedLibModule } from '@my-workspace/shared-lib';

@Module({
  imports: [SharedLibModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### 5. Testing Strategy

- Unit tests at library level
- Integration tests at application level
- Use Nx's affected testing: `nx affected:test`

## Common Issues and Solutions

### 1. TypeScript Path Resolution

**Issue**: Import errors after migration

**Solution**: Update `tsconfig.base.json` paths and ensure consistent naming

### 2. Webpack Configuration

**Issue**: Build failures with custom webpack config

**Solution**: Update webpack config to use Nx's webpack plugin

### 3. Dependency Cycles

**Issue**: Circular dependencies between libraries

**Solution**: Use dependency graph analysis: `nx graph`

### 4. Hot Reload Issues

**Issue**: Development server not reloading on changes

**Solution**: Check `continuous: true` in serve target configuration

### 5. Build Performance

**Issue**: Slow builds

**Solution**: 
- Enable Nx caching
- Use `nx affected` commands
- Implement proper library boundaries

## Commands Reference

```bash
# Build specific project
nx build api

# Serve with hot reload
nx serve api

# Run tests
nx test api

# Run affected tests only
nx affected:test

# Build all affected projects
nx affected:build

# Generate new library
nx g @nx/nest:lib my-new-lib

# Generate new service
nx g @nx/nest:service my-service --project=my-lib

# View dependency graph
nx graph

# Show project details
nx show project api --web
```

## Migration Checklist

- [ ] Create new Nx workspace or add Nx to existing project
- [ ] Install @nx/nest plugin
- [ ] Configure project.json files
- [ ] Update tsconfig.base.json with path mappings
- [ ] Migrate source code to appropriate libraries/applications
- [ ] Update import statements
- [ ] Configure webpack for builds
- [ ] Set up testing configuration
- [ ] Verify build and serve commands work
- [ ] Test library integration
- [ ] Configure CI/CD pipeline for Nx commands
- [ ] Document library APIs and dependencies

This guide provides the foundation for successfully migrating your NestJS project to an Nx monorepo, enabling better code organization, improved build performance, and enhanced developer experience.