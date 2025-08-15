# Config npm Package Integration Plan for Eco-Solver Nx Monorepo

## Executive Summary

This document provides a comprehensive plan to properly integrate the npm `config` package with the eco-solver application in the Nx monorepo. The current implementation has critical issues that prevent proper config loading and environment-specific configuration.

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
└── Merges secrets with base configuration
```

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
```javascript
// BEFORE (config/default.js) - BROKEN
clusterRetryStrategy: (times: number): number => Math.min(times * 1000, 10000),
dnsLookup: (address: string, callback: any) => callback(null, address, 6),

// AFTER (config/default.js) - FIXED
clusterRetryStrategy: (times) => Math.min(times * 1000, 10000),
dnsLookup: (address, callback) => callback(null, address, 6),
```

**Action Items**:
- [ ] Remove all TypeScript type annotations from `.js` files
- [ ] Test config loading with `npm start` after fixes
- [ ] Verify no parsing errors in logs

#### 1.2 Fix AWS Config Service Import Path
**Problem**: Incorrect relative import path
```typescript
// BEFORE - BROKEN
import defaultConfig from '../../../config/default'

// AFTER - FIXED
import * as config from 'config'

// In initConfigs method:
let awsCreds = config.get('aws') as any[]
```

**Action Items**:
- [ ] Update `aws-config.service.ts` import
- [ ] Remove direct file import, use npm config API
- [ ] Test AWS config loading in development environment

#### 1.3 Set NODE_CONFIG_DIR Environment Variable
**Problem**: Config directory not properly resolved in Nx workspace

**Solution**: Set environment variable for Nx workspace
```bash
# For development (add to .env or nx.json)
NODE_CONFIG_DIR=/Users/stoyan/git/worktree/nx_mono_2/config

# For production/deployment
NODE_CONFIG_DIR=/workspace/config
```

**Action Items**:
- [ ] Add NODE_CONFIG_DIR to nx.json serve configuration
- [ ] Update deployment configurations
- [ ] Test config loading from workspace root

### Phase 2: Config Structure Optimization (Week 2)

#### 2.1 Split Static and Dynamic Configuration
**Goal**: Separate JSON-serializable data from JavaScript functions

**Strategy**:
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

**Action Items**:
- [ ] Audit all config files for function vs static data
- [ ] Create `.json` files for static configuration
- [ ] Keep `.js` files only for dynamic logic
- [ ] Update all environment-specific configs (preproduction, production, etc.)

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

**Action Items**:
- [ ] Create environment-specific JSON files
- [ ] Move environment-specific configs from AWS to local files where appropriate
- [ ] Test loading: `NODE_ENV=preproduction npm start`
- [ ] Verify config merging works correctly

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

**Key Benefits**:
- ✅ Proper npm config package integration
- ✅ Environment-specific configuration loading
- ✅ Type-safe configuration access
- ✅ Improved developer experience
- ✅ Robust production deployment