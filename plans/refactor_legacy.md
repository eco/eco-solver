# Legacy Logging Refactoring Plan

## Overview

This plan addresses the refactoring of **298 legacy logging instances** across **63 TypeScript files** to implement the dual logging approach:
- **Automatic operation-level logging** via decorators (`@LogOperation`, `@LogContext`)
- **Explicit business event logging** via specialized logger methods

The refactoring builds on the successful Phase 3 implementation and follows the patterns established in `special-logger.md` and `specific-logs.md`.

## Current State Analysis

### Legacy Logging Distribution
- **298 total instances** of `this.logger.(error|warn|debug|info)`
- **63 files** affected across multiple service categories
- **High concentration areas**:
  - Gateway Provider: 28 instances
  - CCTP-LiFi Provider: 22 instances  
  - Hyperlane Provider: 21 instances
  - Intent Processor: 16 instances
  - LiFi Provider: 14 instances
  - Everclear Provider: 14 instances

### Existing Specialized Loggers
- `IntentOperationLogger` ✅ (Phase 3 complete)
- `LiquidityManagerLogger` ✅
- `QuoteGenerationLogger` ✅
- `TransactionLogger` ✅
- `HealthOperationLogger` ✅
- `GenericOperationLogger` ✅
- `BaseStructuredLogger` ✅

## Refactoring Strategy

### Phase 1: Service Categorization & Context Extractors
**Timeline: Week 1**

#### 1.1 Create Missing Context Extractors
```typescript
// src/common/logging/decorators/context-extractors.ts

// New extractors needed:
export function extractProviderContext(provider: any): ProviderLogContext
export function extractProcessorContext(processor: any): ProcessorLogContext  
export function extractHealthContext(health: any): HealthLogContext
export function extractAnalyticsContext(analytics: any): AnalyticsLogContext
export function extractValidatorContext(validator: any): ValidatorLogContext
```

#### 1.2 Service Category Mapping
**Category A: Liquidity Providers** (47 files, ~150 instances)
- Gateway, LiFi, CCTP, Everclear, Stargate, Squid, Relay, Hyperlane providers
- **Target Logger**: `LiquidityManagerLogger`
- **Context Extractor**: `extractProviderContext`

**Category B: Intent Processing** (12 files, ~45 instances)  
- Intent processors, validators, feasibility services
- **Target Logger**: `IntentOperationLogger`
- **Context Extractor**: `extractIntentContext`

**Category C: BullMQ Processors** (5 files, ~25 instances)
- Solve intent, signer, inbox, eth-ws, interval processors
- **Target Logger**: `GenericOperationLogger` 
- **Context Extractor**: `extractProcessorContext`

**Category D: Health & Monitoring** (4 files, ~15 instances)
- Health indicators, chain monitors, analytics
- **Target Logger**: `HealthOperationLogger`
- **Context Extractor**: `extractHealthContext`

**Category E: Utilities & Infrastructure** (10 files, ~35 instances)
- Redis utils, API executors, config services, repositories
- **Target Logger**: `GenericOperationLogger`
- **Context Extractor**: Create domain-specific extractors

### Phase 2: Business Event Method Identification
**Timeline: Week 1-2**

#### 2.1 Business Event Analysis by Category

**Liquidity Provider Events** (Sample from Gateway analysis):
```typescript
// src/common/logging/loggers/liquidity-manager-logger.ts
// Add these business event methods:

logProviderBootstrap(providerId: string, chainId: number, enabled: boolean): void
logProviderQuoteGeneration(providerId: string, quoteRequest: any, success: boolean): void  
logProviderExecution(providerId: string, walletAddress: string, quote: any): void
logProviderBalanceCheck(providerId: string, domain: string, balance: string): void
logProviderDomainValidation(providerId: string, domain: string, supported: boolean): void
logProviderInsufficientBalance(providerId: string, required: string, available: string): void
```

**Intent Processing Events**:
```typescript
// src/common/logging/loggers/intent-operation-logger.ts
// Already implemented in Phase 3, extend with:

logProcessorJobStart(processorType: string, jobId: string, intentHash: string): void
logProcessorJobComplete(processorType: string, jobId: string, processingTime: number): void
logProcessorJobFailed(processorType: string, jobId: string, error: Error): void
```

**Health & Monitoring Events**:
```typescript
// src/common/logging/loggers/health-operation-logger.ts
// Add these business event methods:

logHealthCheckStart(checkType: string, target: string): void
logHealthCheckResult(checkType: string, target: string, healthy: boolean, details?: any): void
logMonitoringAlert(alertType: string, severity: 'low' | 'medium' | 'high', message: string): void
logSystemStatusChange(component: string, fromStatus: string, toStatus: string): void
```

### Phase 3: Decorator Implementation
**Timeline: Week 2-3**

#### 3.1 Method-Level Refactoring Pattern

**BEFORE (Legacy Pattern)**:
```typescript
export class GatewayProviderService {
  private logger = new Logger(GatewayProviderService.name)

  async ensureBootstrapOnce(id: string = 'bootstrap'): Promise<void> {
    this.logger.debug(EcoLogMessage.withId({
      message: 'Gateway: ensuring bootstrap',
      id,
    }))

    try {
      const bootstrap = cfg.bootstrap
      if (!bootstrap?.enabled) {
        this.logger.debug(EcoLogMessage.withId({
          message: 'Gateway: bootstrap is disabled',
          id,
        }))
        return
      }
      // ... business logic ...
    } catch (error) {
      this.logger.error(`Gateway bootstrap failed: ${error.message}`)
      throw error
    }
  }
}
```

**AFTER (Dual Approach)**:
```typescript
export class GatewayProviderService {
  private logger = new LiquidityManagerLogger('GatewayProviderService')

  @LogOperation('provider_bootstrap', LiquidityManagerLogger)
  async ensureBootstrapOnce(@LogContext id: string = 'bootstrap'): Promise<void> {
    // Automatic operation logging handled by decorator
    
    const cfg = this.configService.getGatewayConfig()
    const bootstrap = cfg.bootstrap
    
    // Business event logging - explicit calls
    this.logger.logProviderBootstrap('Gateway', bootstrap.chainId, bootstrap?.enabled)
    
    if (!bootstrap?.enabled) {
      return // Early return automatically logged by decorator
    }
    
    // ... business logic execution ...
    // Any errors automatically caught and logged by decorator
  }
}
```

#### 3.2 File-by-File Migration Template

**Step 1: Import Updates**
```typescript
// Replace:
import { Logger } from '@nestjs/common'

// With:
import { LiquidityManagerLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
```

**Step 2: Logger Instance Update**
```typescript  
// Replace:
private logger = new Logger(ServiceName.name)

// With:
private logger = new LiquidityManagerLogger('ServiceName')
```

**Step 3: Method Decoration**
```typescript
// Add decorators to public methods:
@LogOperation('operation_name', LiquidityManagerLogger)
async methodName(@LogContext param: Type): Promise<ReturnType> {
  // Method body with business event logging
}
```

### Phase 4: Business Event Integration
**Timeline: Week 3-4**

#### 4.1 Critical Business Events Preservation

**Liquidity Provider Critical Events**:
- Provider enablement/disablement status changes
- Balance threshold violations  
- Domain/chain support validation failures
- Quote generation success/failure with amounts
- Execution transaction hash tracking
- Bootstrap process state changes

**Intent Processing Critical Events**:
- Duplicate intent detection (already implemented)
- Validation failures with specific check details
- Status transitions between processing states  
- Retry attempt tracking with counts
- Feasibility check results (already implemented)

**System Health Critical Events**:
- Service availability status changes
- Performance threshold violations
- Configuration validation failures
- External dependency failures

#### 4.2 Context Enhancement Strategy

**Automatic Context via Decorators**:
- Method entry/exit with execution time
- Parameter values (via `@LogContext`)
- Error details with stack traces
- Return values (configurable)

**Business Context via Logger Methods**:
- Domain-specific identifiers (intentHash, quoteId, etc.)
- Business rule outcomes (feasible/infeasible, valid/invalid)
- State transitions (pending → processing → completed)
- Performance metrics (execution time, retry counts)

### Phase 5: Testing & Validation
**Timeline: Week 4-5**

#### 5.1 Migration Validation Checklist

**Per-File Validation**:
- [ ] All `this.logger.(error|warn|debug|info)` instances removed
- [ ] Appropriate specialized logger imported and instantiated
- [ ] Public methods decorated with `@LogOperation`  
- [ ] Context parameters decorated with `@LogContext`
- [ ] Critical business events preserved via logger methods
- [ ] No manual try-catch logging (handled by decorators)

**Integration Testing**:
- [ ] Log structure matches Datadog schema expectations
- [ ] Context extraction functions work correctly
- [ ] Business event methods produce expected log entries
- [ ] Error propagation maintains original behavior
- [ ] Performance impact within acceptable bounds

#### 5.2 Rollback Strategy
- Maintain feature branches for each service category
- Implement gradual rollout with monitoring
- Keep original logging as comments during validation phase
- Establish log volume and structure monitoring

### Phase 6: Performance Optimization
**Timeline: Week 5**

#### 6.1 Log Volume Management
**Current Estimate**: 298 legacy instances → ~60-80% reduction
- Decorator consolidation: ~200 instances eliminated
- Business event methods: ~50-75 preserved
- Net reduction: ~75% fewer log calls

#### 6.2 Datadog Optimization
- Implement log sampling for debug-level operation logs
- Structure business event logs for optimal query performance
- Add structured indexes for critical business identifiers

## Implementation Schedule (Parallel Execution)

### Phase 1: Foundation Setup (Day 1) - Single Task
**Prerequisites**: Must complete before parallel work begins
- Create missing context extractors (`extractProviderContext`, `extractProcessorContext`, etc.)
- Design business event method signatures for all specialized loggers
- Update logger exports and type definitions

### Phase 2: Parallel Migration (Days 2-14)
**5 Parallel Work Streams** - Each can be executed independently

#### Stream A: High-Volume Liquidity Providers (Claude Task A)
**Files**: 5 files, ~110 instances
- `gateway-provider.service.ts` (28 instances) 
- `cctp-lifi-provider.service.ts` (22 instances)
- `warp-route-provider.service.ts` (21 instances)
- `lifi-provider.service.ts` (14 instances) 
- `everclear-provider.service.ts` (14 instances)

#### Stream B: Medium-Volume Providers (Claude Task B) 
**Files**: 8 files, ~60 instances
- `cctpv2-provider.service.ts` (11 instances)
- `token-cache-manager.ts` (10 instances)
- `stargate-provider.service.ts` (8 instances)
- `squid-provider.service.ts` (5 instances)
- `cctp-provider.service.ts` (4 instances)
- `relay-provider.service.ts` (4 instances)
- Plus 2 smaller provider files (~18 instances total)

#### Stream C: Intent Processing & Validation (Claude Task C)
**Files**: 8 files, ~45 instances  
- `intent-processor.service.ts` (16 instances)
- `validation.sevice.ts` (8 instances)
- `validate-intent.service.ts` (4 instances)
- `permit2-validator.ts` (6 instances)
- `vault-funding-validator.ts` (4 instances)
- Plus 3 smaller processing files (~7 instances total)

#### Stream D: BullMQ Processors & Queue Management (Claude Task D)
**Files**: 8 files, ~35 instances
- `solve-intent.processor.ts` (4 instances)
- `signer.processor.ts` (5 instances) 
- `eth-ws.processor.ts` (6 instances)
- `inbox.processor.ts` (5 instances)
- `interval.processor.ts` (5 instances)
- Plus 3 queue/processor files (~10 instances total)

#### Stream E: Infrastructure & Utilities (Claude Task E)
**Files**: 12 files, ~30 instances
- `quote.service.ts` (2 instances)
- `quote.repository.ts` (6 instances)  
- `balance.service.ts` (2 instances)
- `fee.service.ts` (3 instances)
- `eco-analytics.service.ts` (2 instances)
- Plus 7 smaller utility files (~15 instances total)

### Phase 3: Integration & Validation (Days 15-21)
**Parallel Validation Tasks** - Can run concurrently after Stream completion

#### Validation Stream 1: Provider Services Testing
- Test all migrated provider services (Streams A & B)
- Validate quote generation and execution flows
- Check balance and domain validation logging

#### Validation Stream 2: Processing Pipeline Testing  
- Test intent processing and validation services (Stream C)
- Validate business event preservation
- Check error handling and retry logic

#### Validation Stream 3: Infrastructure Testing
- Test BullMQ processors and utilities (Streams D & E) 
- Validate queue processing and job execution
- Check system health and monitoring logs

## Success Metrics

### Code Quality Metrics
- **Lines of logging code**: Reduce by ~75% (from ~2000+ to ~500)
- **Manual error handling**: Eliminate ~85% of try-catch logging blocks
- **Context consistency**: Achieve 100% structured context coverage
- **Business event coverage**: Preserve 100% of critical business logic

### Operational Metrics
- **Log volume efficiency**: Reduce overall log volume by 40-60%
- **Query performance**: Improve Datadog query response by 30%+
- **Development velocity**: Reduce logging implementation time by 80%
- **Maintenance overhead**: Eliminate manual context synchronization

### Risk Mitigation
- **Zero business logic loss**: All critical events preserved
- **Backward compatibility**: Maintain existing log consumers  
- **Rollback capability**: Safe rollback within 2 hours
- **Performance stability**: No degradation in application performance

## Parallel Execution Coordination

### Local Development Strategy
**⚠️ Important**: All work remains **LOCAL ONLY** - no pushing to remote repositories
- Each parallel stream works on separate local feature branches
- No remote push operations during development phase
- Final integration happens locally before any remote operations

### Branch & Worktree Strategy
**Claude Worktree Behavior**: Each Claude instance operates in the **same working directory**
- Claude does **NOT** automatically create separate worktrees for different branches
- All parallel tasks work in the **same file system location**
- Branch switching happens in-place within the single worktree

**Coordination Solution**: Sequential branch execution within single Claude session
```bash
# Each Claude task handles multiple branches sequentially:
git checkout -b feat/logging-stream-a-providers
# Work on Stream A files
git add . && git commit -m "Stream A: Migrate high-volume providers"

git checkout main
git checkout -b feat/logging-stream-a2-providers  
# Continue with remaining Stream A work
```

### Alternative: Manual Worktree Setup (User-Managed)
If true parallel execution is needed, user must create worktrees manually:
```bash
# User sets up separate worktrees before Claude execution:
git worktree add ../ED-5702-stream-a feat/logging-stream-a-providers
git worktree add ../ED-5702-stream-b feat/logging-stream-b-providers
git worktree add ../ED-5702-stream-c feat/logging-stream-c-processing
git worktree add ../ED-5702-stream-d feat/logging-stream-d-processors
git worktree add ../ED-5702-stream-e feat/logging-stream-e-infrastructure
```

Then each Claude instance works in different directories:
- Claude A: `../ED-5702-stream-a/`
- Claude B: `../ED-5702-stream-b/` 
- etc.

### Inter-Task Dependencies
**Phase 1 Foundation** → All parallel streams (blocking dependency)
**Stream Completion** → Integration testing (can start as streams finish)
**No cross-stream dependencies** → Streams A-E can run completely independently

### Recommended Approach: Sequential Streams in Single Session
Given Claude's single-worktree behavior, the most practical approach:
1. **Single Claude session** handles all streams sequentially
2. **Time-boxed sprints** per stream (1-2 days each)
3. **Local branch management** with clear naming conventions
4. **No remote operations** until final integration

### Progress Tracking
Each Claude task maintains status in:
```
plans/progress/stream-[A-E]-status.md
```

**Status Format**:
```markdown
# Stream [X] Progress

## Completed Files
- [x] filename.ts (instances: X/X complete)

## In Progress  
- [ ] filename.ts (instances: X/Y complete)

## Pending
- [ ] filename.ts (estimated instances: X)

## Blockers
- None / List any issues

## Testing Status
- [ ] Unit tests passing
- [ ] Integration tests ready
```

## Detailed Task Specifications

### Stream A: High-Volume Liquidity Providers
**Claude Task A Instructions**:

```bash
# Files to migrate (in priority order):
src/liquidity-manager/services/liquidity-providers/Gateway/gateway-provider.service.ts
src/liquidity-manager/services/liquidity-providers/CCTP-LiFi/cctp-lifi-provider.service.ts
src/liquidity-manager/services/liquidity-providers/Hyperlane/warp-route-provider.service.ts  
src/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service.ts
src/liquidity-manager/services/liquidity-providers/Everclear/everclear-provider.service.ts
```

**Required Logger**: `LiquidityManagerLogger`
**Context Extractor**: `extractProviderContext` (will be created in Phase 1)
**Business Events**: Provider bootstrap, quote generation, execution, balance checks

### Stream B: Medium-Volume Providers  
**Claude Task B Instructions**:

```bash
# Files to migrate:
src/liquidity-manager/services/liquidity-providers/CCTP-V2/cctpv2-provider.service.ts
src/liquidity-manager/services/liquidity-providers/LiFi/utils/token-cache-manager.ts
src/liquidity-manager/services/liquidity-providers/Stargate/stargate-provider.service.ts
src/liquidity-manager/services/liquidity-providers/Squid/squid-provider.service.ts
src/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service.ts
src/liquidity-manager/services/liquidity-providers/Relay/relay-provider.service.ts
# Plus remaining provider files with <5 instances each
```

### Stream C: Intent Processing & Validation
**Claude Task C Instructions**:

```bash  
# Files to migrate:
src/intent-processor/services/intent-processor.service.ts
src/intent/validation.sevice.ts
src/intent/validate-intent.service.ts  
src/intent-initiation/permit-validation/permit2-validator.ts
src/intent-initiation/permit-validation/vault-funding-validator.ts
src/intent-initiation/permit-validation/permit-validator.ts
src/intent-initiation/permit-validation/permit-validation.service.ts
src/intent-processor/processors/intent.processor.ts
```

**Required Logger**: `IntentOperationLogger` (already has business event methods)
**Context Extractor**: `extractIntentContext` (already exists)

### Stream D: BullMQ Processors & Queue Management
**Claude Task D Instructions**:

```bash
# Files to migrate:
src/bullmq/processors/solve-intent.processor.ts
src/bullmq/processors/signer.processor.ts
src/bullmq/processors/eth-ws.processor.ts  
src/bullmq/processors/inbox.processor.ts
src/bullmq/processors/interval.processor.ts
src/common/bullmq/base.processor.ts
src/common/bullmq/grouped-jobs.processor.ts
src/liquidity-manager/jobs/eco-cron-job-manager.ts
```

**Required Logger**: `GenericOperationLogger`  
**Context Extractor**: `extractProcessorContext` (will be created in Phase 1)

### Stream E: Infrastructure & Utilities
**Claude Task E Instructions**:

```bash
# Files to migrate:
src/quote/quote.service.ts
src/quote/quote.repository.ts
src/balance/balance.service.ts  
src/fee/fee.service.ts
src/analytics/eco-analytics.service.ts
src/eco-configs/eco-config.service.ts
src/eco-configs/aws-config.service.ts
# Plus remaining utility files
```

**Required Loggers**: Mixed (`QuoteGenerationLogger`, `GenericOperationLogger`, `HealthOperationLogger`)
**Context Extractors**: Domain-specific extractors per service type

## Local Integration Strategy
**All work remains local until final review and approval**

### Sequential Local Integration
```bash
# Foundation first (Phase 1)
git checkout main
git checkout -b feat/logging-foundation
# Complete foundation work (context extractors, business event methods)
git commit -m "Foundation: Add context extractors and business event methods"

# Stream A 
git checkout main  
git merge feat/logging-foundation  # Merge foundation locally
git checkout -b feat/logging-stream-a-providers
# Complete Stream A work
git commit -m "Stream A: Migrate high-volume provider services"

# Stream B (includes foundation + Stream A)
git checkout main
git merge feat/logging-stream-a-providers  # Local merge
git checkout -b feat/logging-stream-b-providers
# Complete Stream B work
git commit -m "Stream B: Migrate medium-volume provider services"

# Continue pattern for Streams C, D, E...
```

### Integration Testing Approach
```bash
# Create integration test branch with all streams
git checkout main
git merge feat/logging-stream-e-infrastructure  # Final stream merge
git checkout -b feat/logging-integration-test

# Run full test suite
npm run test
npm run lint  
npm run typecheck

# Only after local validation is complete:
# User manually reviews and decides on remote operations
```

### Final Review & Remote Operations (User-Controlled)
**Claude will NOT push to remote**. User controls all remote operations:
1. **Local review**: User examines all local branches and commits
2. **Manual testing**: User runs application locally to validate changes
3. **Remote decision**: User decides if/when to push to remote repository
4. **PR creation**: User manually creates pull requests if desired

This approach ensures **complete local control** while enabling systematic migration across all 298 logging instances.