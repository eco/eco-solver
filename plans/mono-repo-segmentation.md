# Mono-Repo Segmentation Plan: Eco-Solver Architecture Refactoring

## Executive Summary

This plan outlines the architectural transformation of the eco-solver from a monolithic NestJS application into a segmented microservices architecture using Nx build optimizations. The migration addresses critical technical debt while following DRY principles and improving build performance.

### Architecture Score: 45/100 → Target: 85/100

## Current State Analysis

### Critical Issues Identified

1. **Massive Monolith**: 534+ TypeScript files in single eco-solver app
2. **God Objects**: 
   - QuoteService: 817 lines (apps/eco-solver/quote/quote.service.ts:57)
   - FeeService: 689 lines 
3. **Circular Dependencies**: 5 detected in libs infrastructure layer
4. **No Build Optimization**: Missing Nx task caching and module boundaries
5. **Tight Coupling**: 35+ feature modules cross-referencing each other

### Current Nx Workspace State

- **Nx version**: 19.8.0
- **Projects**: 1 app + 6 libraries
- **Missing**: Module boundary enforcement, build caching, incremental builds
- **Libraries**: fee-calculator, shared, solver, quote, dex, liquidity

## Proposed Architecture

### 1. Application Breakdown

Break the monolithic eco-solver into 6 focused applications:

```
apps/
├── eco-solver-api/              # API gateway & controllers
│   ├── src/api/                 # REST controllers only
│   ├── src/health/              # Health checks
│   └── main.ts
├── eco-intent-processor/        # Intent processing service
│   ├── src/processors/          # Intent workflow processing
│   ├── src/queues/              # Message queue handling
│   └── src/validation/          # Intent validation logic
├── eco-liquidity-manager/       # Liquidity management service
│   ├── src/providers/           # 8+ liquidity providers
│   ├── src/rebalancing/         # Rebalancing logic
│   └── src/monitoring/          # Liquidity monitoring
├── eco-quote-engine/           # Quote generation service
│   ├── src/calculation/         # Quote calculations
│   ├── src/validation/          # Quote validation
│   └── src/caching/             # Quote caching
├── eco-transaction-service/    # Transaction execution
│   ├── src/smart-wallets/       # Smart wallet integrations
│   ├── src/signing/             # Transaction signing
│   └── src/broadcasting/        # Transaction broadcasting
└── eco-monitoring/             # Chain monitoring & events
    ├── src/watchers/            # Chain watchers
    ├── src/indexer/             # Event indexer
    └── src/events/              # Event processing
```

### 2. Enhanced Library Structure

Reorganize libraries following DDD principles and Nx best practices:

```
libs/
├── domain/                     # Business domain logic (NEW)
│   ├── intent-core/           # ✅ Already exists - enhance
│   ├── quote-domain/          # Extract from QuoteService
│   ├── liquidity-domain/      # Extract liquidity business rules
│   ├── fee-domain/            # Extract from FeeService 
│   └── transaction-domain/    # Transaction business rules
├── application/               # Use cases/workflows (NEW)
│   ├── intent-usecases/       # Intent processing workflows
│   ├── quote-usecases/        # Quote generation workflows  
│   ├── liquidity-usecases/    # Liquidity management workflows
│   └── transaction-usecases/  # Transaction execution workflows
├── infrastructure/            # ✅ Fix circular dependencies
│   ├── blockchain/            # ✅ Exists - enhance
│   ├── config/                # ✅ Fix circular deps with database
│   ├── database/              # ✅ Exists - note: exports now explicit
│   ├── external-apis/         # ✅ Fix circular deps with config
│   ├── messaging/             # NEW: BullMQ abstractions
│   └── wallets/               # NEW: Wallet integrations
├── shared/                    # ✅ Good structure - enhance
│   ├── dto/                   # ✅ Exists
│   ├── types/                 # ✅ Exists
│   ├── utils/                 # ✅ Exists
│   ├── constants/             # NEW: Shared constants
│   └── validation/            # NEW: Common validators
└── foundation/
    ├── eco-adapter/           # ✅ Exists
    └── common-interfaces/     # NEW: Shared interfaces
```

## Nx Build Optimizations

### 1. Enhanced nx.json Configuration

Updated configuration with comprehensive caching and optimization:

```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
      "!{projectRoot}/tsconfig.spec.json",
      "!{projectRoot}/jest.config.[jt]s",
      "!{projectRoot}/.eslintrc.json"
    ],
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
      "cache": true
    }
  }
}
```

### 2. Module Boundary Enforcement

New `.eslintrc.json` with strict module boundaries:

```json
{
  "rules": {
    "@nx/enforce-module-boundaries": [
      "error", 
      {
        "enforceBuildableLibDependency": true,
        "depConstraints": [
          {
            "sourceTag": "scope:api",
            "onlyDependOnLibsWithTags": ["scope:shared", "scope:core", "type:data-access"]
          },
          {
            "sourceTag": "scope:core", 
            "onlyDependOnLibsWithTags": ["scope:shared", "type:util", "type:data-access"]
          },
          {
            "sourceTag": "type:data-access",
            "onlyDependOnLibsWithTags": ["type:util", "scope:shared"]
          }
        ]
      }
    ]
  }
}
```

## Migration Implementation Plan

### Phase 1: Foundation Setup (Week 1)

#### Immediate Nx Commands:
```bash
# 1. Generate new applications
nx generate @nx/node:application eco-solver-api --tags=scope:api,type:app
nx generate @nx/node:application eco-intent-processor --tags=scope:core,type:app
nx generate @nx/node:application eco-liquidity-manager --tags=scope:core,type:app
nx generate @nx/node:application eco-quote-engine --tags=scope:core,type:app
nx generate @nx/node:application eco-transaction-service --tags=scope:core,type:app
nx generate @nx/node:application eco-monitoring --tags=scope:api,type:app

# 2. Generate core domain libraries
nx generate @nx/js:library domain/quote-domain --buildable --tags=scope:core,type:data-access
nx generate @nx/js:library domain/fee-domain --buildable --tags=scope:core,type:data-access
nx generate @nx/js:library domain/liquidity-domain --buildable --tags=scope:core,type:data-access
nx generate @nx/js:library domain/transaction-domain --buildable --tags=scope:core,type:data-access

# 3. Generate application use case libraries
nx generate @nx/js:library application/quote-usecases --buildable --tags=scope:core,type:feature
nx generate @nx/js:library application/intent-usecases --buildable --tags=scope:core,type:feature
nx generate @nx/js:library application/liquidity-usecases --buildable --tags=scope:core,type:feature
```

#### Critical Actions:
1. **Fix Circular Dependencies**: Database exports now explicit (libs/infrastructure/database/src/index.ts:1-19)
2. **Update nx.json**: Enable task caching and build optimization
3. **Configure Module Boundaries**: Enforce architectural constraints
4. **Create New Application Shells**: Minimal NestJS apps for each service

### Phase 2: God Service Decomposition (Week 2)

#### QuoteService Refactoring (817 lines → Multiple focused services)

**Extract to libs/domain/quote-domain:**
```typescript
// Quote business logic extracted from apps/eco-solver/quote/quote.service.ts:57
export class QuoteValidator {
  validateQuoteIntentData(quoteIntentModel: QuoteIntentModel): Promise<Quote400 | undefined>
}

export class QuotePricer {
  generateQuote(quoteIntentModel: QuoteIntentDataInterface): Promise<EcoResponse<QuoteDataEntryDTO>>
  generateReverseQuote(intent: QuoteIntentDataInterface): Promise<EcoResponse<QuoteDataEntryDTO>>
}

export class QuoteOrchestrator {
  // Coordinates quote generation from apps/eco-solver/quote/quote.service.ts:128
  private async _getQuote(...): Promise<EcoResponse<QuoteDataDTO>>
}
```

**Extract to libs/application/quote-usecases:**
```typescript
export class GenerateQuoteUseCase {
  async execute(quoteIntentDataDTO: QuoteIntentDataDTO): Promise<EcoResponse<QuoteDataDTO>>
}
```

#### FeeService Refactoring (689 lines → Focused domain service)

Move FeeService logic to enhanced `libs/fee-calculator` with proper domain separation.

### Phase 3: Service Integration (Week 3)

#### Application Wiring Strategy:
1. **eco-solver-api**: Thin API gateway routing to services
2. **eco-quote-engine**: Hosts QuoteService logic with new domain libs
3. **eco-intent-processor**: Intent processing workflows 
4. **eco-liquidity-manager**: 8+ provider services coordination
5. **eco-transaction-service**: Smart wallet and transaction logic
6. **eco-monitoring**: Chain watching and event processing

#### Inter-Service Communication:
```typescript
// Message bus pattern for service communication
// libs/infrastructure/messaging/
export interface MessageBus {
  publish(event: DomainEvent): Promise<void>
  subscribe(handler: EventHandler): void
}
```

### Phase 4: Build Optimization (Week 4)

#### Performance Improvements:
```bash
# Enable parallel builds with affected-only strategy
nx affected:build --parallel --maxParallel=4

# Incremental testing
nx affected:test --parallel --maxParallel=4

# Dependency graph validation
nx graph --focus=eco-solver-api --exclude=*spec*
```

## Expected Benefits

### Build Performance Metrics:
- **Build Time Reduction**: 40-60% through incremental builds
- **CI/CD Pipeline**: 70% faster with affected-only builds  
- **Cache Hit Rate**: 80%+ for unchanged code
- **Local Development**: Hot reloading and incremental compilation

### Architecture Quality Improvements:
- **Maintainability**: Smaller, focused services (100-200 lines vs 817)
- **Scalability**: Independent scaling per service
- **Team Velocity**: Parallel development by multiple teams
- **Testability**: Better isolation for unit/integration testing
- **Deployment**: Independent service deployment

### DRY Principle Compliance:
- **Shared Libraries**: Common utilities in `libs/shared/`
- **Domain Logic**: Extracted to reusable domain libraries
- **Configuration**: Centralized in `libs/infrastructure/config/`
- **Validation**: Common validators in `libs/shared/validation/`

## Risk Mitigation

### Migration Risks:
1. **Breaking Changes**: Incremental migration with feature flags
2. **Performance Regression**: Benchmark before/after each phase
3. **Database Transactions**: Maintain ACID properties across services
4. **Service Communication**: Implement circuit breakers and retries

### Rollback Strategy:
- Keep original eco-solver running during migration
- Feature toggle between monolith and microservices
- Database schema compatibility maintained
- Gradual traffic shifting per service

## Success Metrics

### Week 1 Targets:
- [ ] All 6 new applications generated and building
- [ ] Module boundary rules passing
- [ ] Build cache hit rate > 50%

### Week 2 Targets:
- [ ] QuoteService decomposed (817 lines → 3 focused services)
- [ ] FeeService extracted to enhanced fee-calculator
- [ ] Circular dependencies eliminated

### Week 3 Targets:
- [ ] Service integration complete
- [ ] API gateway routing functional
- [ ] Inter-service communication established

### Week 4 Targets:
- [ ] Build time reduced by 40%+
- [ ] All tests passing
- [ ] Production deployment ready

## Maintenance Guidelines

### Daily Operations:
```bash
# Health checks
nx graph --file=health-check.json
nx affected:build --dry-run
nx workspace-lint
```

### Weekly Reviews:
```bash
# Architecture validation
nx dep-graph --focus=eco-quote-engine  
nx run-many --target=test --parallel --verbose
```

### Monthly Assessments:
```bash
# Full workspace analysis
nx report
nx show projects --with-target=build
```

This comprehensive migration plan transforms the eco-solver from a monolithic application into a maintainable, scalable microservices architecture while leveraging Nx build optimizations for maximum performance and developer productivity.

## Implementation Notes

- **Database Circular Deps**: Already addressed with explicit exports in libs/infrastructure/database/src/index.ts:1-19
- **Current QuoteService**: Heavy analytics integration (apps/eco-solver/quote/quote.service.ts:100-278) needs careful extraction
- **Priority Focus**: Start with QuoteService decomposition as it's the largest god object

Ready for implementation with expected 85/100 architecture score upon completion.