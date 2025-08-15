# Config npm Package Integration Plan for Eco-Solver Nx Monorepo
*Updated for Claude Sonnet Execution*

## Executive Summary

This document provides a comprehensive, actionable plan to properly integrate the npm `config` package with the eco-solver application in the Nx monorepo. The current implementation has critical issues that prevent proper config loading and environment-specific configuration.

**For Claude Sonnet**: This plan has been structured with specific file paths, code changes, and verification steps to enable automated execution.

## Current State Analysis

### Issues Identified

1. **Parse Errors**: TypeScript syntax in `.js` config files causes npm config package to fail
2. **Incorrect Import Paths**: `aws-config.service.ts` uses relative paths (`../../../config/default`) that break in Nx structure
3. **Environment Loading**: Not utilizing npm config's built-in NODE_ENV-based file loading
4. **File Format Mismatch**: Mix of TypeScript syntax and JavaScript files without proper separation

### Current Directory Structure
```
/config/
├── default.js          ← Contains TS syntax causing parse errors
├── development.js      ← Unknown status
├── preproduction.js    ← Working JS syntax
├── production.js       ← Unknown status
├── staging.js          ← Unknown status
└── test.js            ← Unknown status
```

### Configuration Service Architecture
```
EcoConfigService (main config service)
├── Uses npm config package directly
├── Merges with ConfigSource providers (AWS secrets)
├── Integrates with EcoChains for RPC configuration
└── Provides typed configuration access methods

AwsConfigService (implements ConfigSource)
├── Fetches secrets from AWS Secrets Manager
├── Currently imports ../../../config/default (BROKEN PATH)
├── **REQUIRES**: 'ap' command connection to AWS instance
└── Merges secrets with base configuration
```

**AWS Connection Dependency**:
- The `ap` command establishes connection to AWS instance
- Required for AWS Secrets Manager access
- Must be executed before any AWS config testing

## npm Config Package Analysis

### How npm Config Package Works
1. **Automatic File Loading**:
   - `default.{js|json}` - Base configuration (always loaded)
   - `${NODE_ENV}.{js|json}` - Environment-specific overrides
   - `local.{js|json}` - Local overrides (typically gitignored)

2. **File Format Support**:
   - **JSON**: Primary format, static configuration
   - **JavaScript**: For dynamic configurations and functions
   - **TypeScript**: NOT directly supported (requires compilation)

3. **Environment Resolution**:
   - Uses `NODE_ENV` environment variable
   - Example: `NODE_ENV=preproduction` → loads `default` + `preproduction`
   - Later configs override earlier ones via deep merge

4. **Directory Resolution**:
   - Default: `/config` directory relative to app root
   - Customizable via `NODE_CONFIG_DIR` environment variable

## Integration Strategy

### Phase 1: Critical Fixes (Immediate - Week 1)

#### 1.1 Fix Parse Errors in Config Files
**Problem**: TypeScript syntax in JavaScript files
**File**: `config/default.js`

**Claude Sonnet Action**:
1. Read `config/default.js` to identify TypeScript syntax issues
2. Remove all TypeScript type annotations (`: number`, `: string`, `: any`, etc.)
3. Update function signatures to valid JavaScript

```javascript
// BEFORE (config/default.js) - BROKEN
clusterRetryStrategy: (times: number): number => Math.min(times * 1000, 10000),
dnsLookup: (address: string, callback: any) => callback(null, address, 6),

// AFTER (config/default.js) - FIXED
clusterRetryStrategy: (times) => Math.min(times * 1000, 10000),
dnsLookup: (address, callback) => callback(null, address, 6),
```

**Verification Steps**:
1. Run `node -c config/default.js` to check syntax
2. Test config loading with `pnpm nx serve eco-solver`
3. Check logs for config parsing errors

#### 1.2 Fix AWS Config Service Import Path
**Problem**: Incorrect relative import path
**File**: `apps/eco-solver/*/aws-config.service.ts` (need to locate exact path)

**Claude Sonnet Action**:
1. Find `aws-config.service.ts` using search tools
2. Replace direct file import with npm config API usage
3. Update all references to use config.get() instead of direct imports
4. **CRITICAL**: Ensure AWS connection via 'ap' command before testing

```typescript
// BEFORE - BROKEN
import defaultConfig from '../../../config/default'

// AFTER - FIXED
import * as config from 'config'

// In initConfigs method:
let awsCreds = config.get('aws') as any[]
```

**Search Command**: `grep -r "config/default" apps/eco-solver/`
**AWS Connection Requirement**:
- Must run `ap` command to connect to AWS instance before testing AWS config functionality
- AWS configs are fetched from AWS Secrets Manager, requiring active connection

**Verification Steps**:
1. Search for all files importing config/default
2. Replace imports with npm config API calls
3. **PREREQUISITE**: Run `ap` command to connect to AWS
4. Test AWS config loading: `NODE_ENV=preproduction pnpm nx serve eco-solver` (preproduction is most stable env)

#### 1.3 Set NODE_CONFIG_DIR Environment Variable
**Problem**: Config directory not properly resolved in Nx workspace
**Files**: `apps/eco-solver/project.json`, `.env` (if exists)

**Claude Sonnet Action**:
1. Read `apps/eco-solver/project.json` to find serve target configuration
2. Add NODE_CONFIG_DIR environment variable to serve target
3. Create/update `.env` file in workspace root if needed

**Implementation**:
```json
// In apps/eco-solver/project.json
{
  "targets": {
    "serve": {
      "executor": "@nx/node:node",
      "options": {
        "env": {
          "NODE_CONFIG_DIR": "config"
        }
      }
    }
  }
}
```

**Alternative**: Add to workspace `.env` file:
```bash
NODE_CONFIG_DIR=config
```

**Verification Steps**:
1. Check current project.json structure
2. Add environment variable configuration
3. Test: `NODE_ENV=preproduction pnpm nx serve eco-solver --verbose` (use preproduction as primary test env)

### Phase 2: Config Structure Optimization (Week 2)

#### 2.1 Split Static and Dynamic Configuration
**Goal**: Separate JSON-serializable data from JavaScript functions
**Files**: All files in `config/` directory

**Claude Sonnet Action**:
1. Read all config files in `config/` directory
2. Identify static data vs dynamic functions in each file
3. Create corresponding `.json` files for static data
4. Update `.js` files to contain only functions

**Implementation Strategy**:
```javascript
// config/default.json (static data only)
{
  "aws": [...],
  "cache": { "ttl": 10000 },
  "redis": {
    "options": {
      "single": { "autoResubscribe": true },
      "cluster": {
        "enableReadyCheck": true,
        "retryDelayOnClusterDown": 300
      }
    }
  },
  "intentConfigs": {...}
}

// config/default.js (functions only)
module.exports = {
  redis: {
    options: {
      cluster: {
        clusterRetryStrategy: (times) => Math.min(times * 1000, 10000),
        dnsLookup: (address, callback) => callback(null, address, 6)
      }
    }
  }
}
```

**Step-by-Step Process**:
1. `ls config/` - List all config files
2. For each `.js` file:
   - Read file contents
   - Extract static objects to new `.json` file
   - Remove static data from `.js` file, keep only functions
   - Verify `.js` files contain valid JavaScript syntax
3. Test each environment: `NODE_ENV=<env> node -e "console.log(require('config'))"`

#### 2.2 Implement Proper Environment-Specific Loading
**Goal**: Leverage npm config's built-in environment support

**Current Environment Files Needed**:
```
config/
├── default.json        ← Base configuration
├── default.js          ← Base dynamic functions
├── development.json    ← Dev overrides
├── preproduction.json  ← Preprod overrides  
├── production.json     ← Prod overrides
├── staging.json        ← Staging overrides
└── test.json          ← Test overrides
```

**Claude Sonnet Tasks**:
1. Check which environment files exist: `ls config/`
2. For missing environments, create from existing templates
3. Validate environment-specific overrides are properly structured
4. Test each environment (prioritize preproduction as most stable):
   - `NODE_ENV=preproduction node -e "console.log(require('config').get('redis'))"` (PRIMARY)
   - `NODE_ENV=development node -e "console.log(require('config').get('redis'))"`
   - `NODE_ENV=production node -e "console.log(require('config').get('redis'))"`

### Phase 3: Nx Integration Enhancement (Week 3)

#### 3.1 Update Nx Project Configuration
**Goal**: Properly integrate config loading with Nx build system

**nx.json Updates**:
```json
{
  "projects": {
    "eco-solver": {
      "targets": {
        "serve": {
          "executor": "@nx/node:node",
          "options": {
            "buildTarget": "eco-solver:build",
            "env": {
              "NODE_CONFIG_DIR": "config"
            }
          }
        }
      }
    }
  }
}
```

**Action Items**:
- [ ] Update nx.json with NODE_CONFIG_DIR
- [ ] Update project.json for eco-solver app
- [ ] Test with `nx serve eco-solver`
- [ ] Verify config loading in Nx environment

#### 3.2 Add TypeScript Type Generation
**Goal**: Maintain type safety for configuration

**Strategy**:
```typescript
// libs/infrastructure/config/src/config.types.ts
export interface AppConfig {
  aws: AwsCredential[]
  redis: RedisConfig
  database: DatabaseConfig
  // ... other config types
}

// Generate from config structure
export type ConfigKey = keyof AppConfig
```

**Action Items**:
- [ ] Create comprehensive config type definitions
- [ ] Generate types from actual config structure
- [ ] Update EcoConfigService with proper typing
- [ ] Add config validation using types

#### 3.3 Update Build and Deployment Configs
**Goal**: Ensure config works in all deployment environments

**Docker/Deployment Updates**:
```dockerfile
# Set config directory for container
ENV NODE_CONFIG_DIR=/app/config
COPY config/ /app/config/
```

**Action Items**:
- [ ] Update Docker configurations
- [ ] Update CI/CD pipelines
- [ ] Test in staging environment
- [ ] Verify production deployment

### Phase 4: Advanced Features (Week 4)

#### 4.1 Add Config Validation
**Goal**: Validate configuration at startup

```typescript
import Joi from 'joi'

const configSchema = Joi.object({
  aws: Joi.array().items(Joi.object({
    region: Joi.string().required(),
    secretID: Joi.string().required()
  })),
  redis: Joi.object().required(),
  database: Joi.object().required()
})

// In EcoConfigService constructor
const validation = configSchema.validate(this.ecoConfig)
if (validation.error) {
  throw new Error(`Configuration validation failed: ${validation.error.message}`)
}
```

**Action Items**:
- [ ] Add joi dependency
- [ ] Create validation schemas
- [ ] Implement validation in config service
- [ ] Add startup config validation

#### 4.2 Implement Config Hot Reloading (Development Only)
**Goal**: Allow config changes without restart during development

```typescript
import chokidar from 'chokidar'

// Development only
if (process.env.NODE_ENV === 'development') {
  const watcher = chokidar.watch('config/*.{js,json}')
  watcher.on('change', () => {
    // Reload configuration
    delete require.cache[require.resolve('config')]
    this.reloadConfig()
  })
}
```

**Action Items**:
- [ ] Add chokidar dependency
- [ ] Implement hot reload for development
- [ ] Test config changes without restart
- [ ] Document development workflow

## Alternative Solutions Considered

### Option B: Migrate to node-config-ts
**Pros**: Native TypeScript support, better type safety
**Cons**: Additional complexity, different API, migration effort
**Decision**: Keep current approach, evaluate later

### Option C: Custom Config Library
**Pros**: Full control, perfect Nx integration
**Cons**: Significant development effort, maintenance overhead
**Decision**: Build on existing infrastructure/config library if needed

## Risk Assessment

### High Risk
- **Config Parse Errors**: Application won't start without Phase 1 fixes
- **AWS Integration**: Secrets loading might fail with path fixes

### Medium Risk
- **Environment Loading**: May need debugging for specific environments
- **Nx Integration**: Build system changes need thorough testing

### Low Risk
- **Type Safety**: Gradual improvement, doesn't break existing functionality
- **Advanced Features**: Optional enhancements

## Testing Strategy

### Unit Tests
- [ ] Config service loading tests
- [ ] Environment-specific config tests
- [ ] AWS integration tests
- [ ] Config validation tests

### Integration Tests
- [ ] End-to-end config loading in different environments
- [ ] Nx build system integration tests
- [ ] Docker deployment tests

### Manual Testing
- [ ] Local development with NODE_ENV variations
- [ ] Staging environment deployment
- [ ] Production environment verification

## Success Criteria

1. **Immediate (Phase 1)**:
   - ✅ Application starts without config parse errors
   - ✅ AWS secrets load correctly
   - ✅ Environment-specific configs load based on NODE_ENV

2. **Short-term (Phases 2-3)**:
   - ✅ Clean separation of static/dynamic configuration
   - ✅ Proper Nx integration with workspace-level config
   - ✅ Type-safe configuration access

3. **Long-term (Phase 4)**:
   - ✅ Configuration validation at startup
   - ✅ Improved developer experience
   - ✅ Robust deployment configuration

## Implementation Timeline

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1 | Week 1 | Critical fixes, app starts successfully |
| Phase 2 | Week 2 | Optimized config structure, environment loading |
| Phase 3 | Week 3 | Full Nx integration, type safety |
| Phase 4 | Week 4 | Advanced features, validation |

## Conclusion

This plan addresses all critical issues with the current config integration while providing a path for long-term improvements. The phased approach ensures the application remains functional throughout the migration process.

**Next Steps**:
1. Begin with Phase 1 critical fixes immediately
2. Test thoroughly in development environment
3. Proceed with subsequent phases once stability is confirmed
4. Monitor for any issues in staging/production environments

## Claude Sonnet Execution Checklist

### Phase 1 - Critical Fixes (Execute Immediately)
```bash
# Step 1: Fix config file syntax errors
1. Read config/default.js
2. Remove TypeScript type annotations
3. Validate: node -c config/default.js

# Step 2: Fix AWS config service imports  
1. Grep search: "config/default" in apps/eco-solver/
2. Replace imports with: import * as config from 'config'
3. Update usage to: config.get('aws')
4. **CRITICAL**: Run 'ap' command before AWS testing

# Step 3: Set NODE_CONFIG_DIR
1. Read apps/eco-solver/project.json
2. Add NODE_CONFIG_DIR to serve target env
3. Test: pnpm nx serve eco-solver --verbose
```

### AWS Connection Prerequisites
```bash
# Required before any AWS config testing
ap  # Connect to AWS instance

# Verify AWS connection
aws sts get-caller-identity  # Optional verification
```

### Phase 2 - Config Structure (Week 2)
```bash
# Step 4: Split static/dynamic configs
1. ls config/ - audit all files
2. For each .js file: extract static → .json, keep functions in .js
3. Test: NODE_ENV=preproduction node -e "console.log(require('config'))" (use stable preproduction)

# Step 5: Environment-specific configs
1. Create missing environment .json files
2. Test environments prioritizing preproduction (most stable)
```

### Phase 3 - Nx Integration (Week 3)  
```bash
# Step 6: Update Nx configuration
1. Update apps/eco-solver/project.json with NODE_CONFIG_DIR
2. Test with: nx serve eco-solver
3. Verify config loading in Nx environment
```

### Verification Commands
```bash
# Syntax check
node -c config/default.js

# AWS connection (REQUIRED for AWS configs)
ap

# Config loading test
NODE_ENV=development node -e "console.log(require('config').util.getConfigSources())"

# Full app test (with AWS connection)
ap && pnpm nx serve eco-solver

# Environment test (with AWS connection) - USE PREPRODUCTION AS PRIMARY TEST ENV
ap && NODE_ENV=preproduction pnpm nx serve eco-solver
```

### Important Notes for AWS Integration
- **Always run `ap` command before testing AWS-dependent functionality**
- **Use `NODE_ENV=preproduction` as primary test environment (most stable)**
- Local config files work without AWS connection
- AWS Secrets Manager configs require active AWS connection via `ap`
- Consider fallback mechanisms for local development without AWS access

**Key Benefits**:
- ✅ Proper npm config package integration
- ✅ Environment-specific configuration loading
- ✅ Type-safe configuration access
- ✅ Improved developer experience
- ✅ Robust production deployment