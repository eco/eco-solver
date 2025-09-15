# High Priority Logging Improvements Plan

**Timeline: Weeks 1-2**  
**Estimated Effort: 8-12 developer days**

## 1. Standardize Error Logging Patterns

### Objective

Replace inconsistent error logging with structured, context-aware error handling across all services.

### Current State Analysis

- Mixed logging patterns: some use structured logging, others use basic `console.log`
- Inconsistent error context across 83 files with logging
- Missing error categorization and recovery information

### Implementation Tasks

#### Task 1.1: Create Standardized Error Logger Interface

```typescript
// Location: src/common/logging/interfaces/error-logging.interface.ts
interface ErrorLoggingContext extends BusinessContext {
  operation_stage: string
  recovery_possible: boolean
  error_category: ErrorCategory
  correlation_id?: string
  user_impact?: 'none' | 'degraded' | 'blocked'
}

enum ErrorCategory {
  VALIDATION = 'validation',
  NETWORK = 'network',
  BLOCKCHAIN = 'blockchain',
  BUSINESS_LOGIC = 'business_logic',
  EXTERNAL_API = 'external_api',
  DATABASE = 'database',
  SYSTEM = 'system',
}
```

#### Task 1.2: Implement Base Error Logger Mixin

```typescript
// Location: src/common/logging/mixins/error-logging.mixin.ts
export function ErrorLoggingMixin<T extends Constructor>(Base: T) {
  return class extends Base {
    protected logError(
      context: BusinessContext,
      error: Error,
      operation: string,
      additionalContext?: Partial<ErrorLoggingContext>,
    ): void {
      // Implementation with structured error logging
    }

    protected categorizeError(error: Error): ErrorCategory {
      // Error categorization logic
    }

    protected isRecoverableError(error: Error): boolean {
      // Recovery assessment logic
    }
  }
}
```

#### Task 1.3: Update Existing Services (18 Files)

**Files to Update:**

- `src/modules/intent/services/*.ts` (5 files)
- `src/modules/liquidity/services/*.ts` (7 files)
- `src/modules/quote/services/*.ts` (3 files)
- `src/modules/health/services/*.ts` (3 files)

**Migration Pattern:**

```typescript
// BEFORE:
this.logger.error('Operation failed', error.message)

// AFTER:
this.logError(context, error, 'intent_processing', {
  operation_stage: 'validation',
  recovery_possible: true,
  error_category: ErrorCategory.VALIDATION,
})
```

### Testing Strategy

#### Unit Tests

- **New Test Files:**
  - `src/common/logging/interfaces/error-logging.interface.spec.ts`
  - `src/common/logging/mixins/error-logging.mixin.spec.ts`
- **Test Coverage Requirements:** 95%+
- **Key Test Scenarios:**
  - Error categorization accuracy
  - Context preservation
  - Datadog size limit compliance
  - Sensitive data redaction

#### Integration Tests

- **File:** `test/logging/error-integration.spec.ts`
- **Scenarios:**
  - End-to-end error logging flow
  - APM correlation (when available)
  - Log aggregation and filtering

#### Regression Testing

- **Risk:** Breaking existing log parsing in monitoring dashboards
- **Mitigation:**
  - Backward compatibility layer for 2 weeks
  - Parallel logging during transition period
  - Dashboard validation scripts

## 2. Implement APM Trace Correlation

### Objective

Add distributed tracing correlation to all business operation logs for better observability.

### Implementation Tasks

#### Task 2.1: APM Integration Module

```typescript
// Location: src/common/logging/apm/trace-correlation.ts
export class TraceCorrelation {
  static getTraceId(): string | undefined
  static getSpanId(): string | undefined
  static createCorrelationContext(): APMContext
}

interface APMContext {
  trace_id?: string
  span_id?: string
  parent_id?: string
  sampling_priority?: number
}
```

#### Task 2.2: Update All Structured Loggers

**Files to Update:**

- `src/common/logging/loggers/intent-operation-logger.ts`
- `src/common/logging/loggers/liquidity-manager-logger.ts`
- `src/common/logging/loggers/quote-generation-logger.ts`
- `src/common/logging/loggers/health-operation-logger.ts`

**Enhancement Pattern:**

```typescript
// Add to each logger's context building:
private enrichWithAPM(context: BusinessContext): BusinessContext {
  const apmContext = TraceCorrelation.createCorrelationContext();
  return { ...context, ...apmContext };
}
```

#### Task 2.3: Environment Configuration

```typescript
// Location: config/default.ts - APM section
apm: {
  enabled: process.env.DD_TRACE_ENABLED === 'true',
  service_name: process.env.DD_SERVICE || 'eco-backend',
  correlation: {
    inject_trace_id: true,
    inject_span_id: true
  }
}
```

### Testing Strategy

#### Unit Tests

- **New Test Files:**
  - `src/common/logging/apm/trace-correlation.spec.ts`
- **Mock APM tracer for testing**
- **Verify trace ID injection in logs**

#### Integration Tests

- **File:** `test/logging/apm-integration.spec.ts`
- **Scenarios:**
  - Trace correlation across service boundaries
  - Performance impact measurement
  - Fallback behavior when APM unavailable

### Potential Breaking Changes

- **Risk:** Log structure changes may break existing dashboards
- **Mitigation:**
  - Feature flag for APM correlation (`ENABLE_APM_CORRELATION`)
  - Gradual rollout by service
  - Dashboard update scripts provided

## 3. Add Smart Wallet Operations Logging

### Objective

Implement comprehensive structured logging for all smart wallet operations currently missing coverage.

### Current Coverage Gaps

- Wallet deployment transactions
- Signature verification failures
- Nonce management conflicts
- Gas estimation errors
- Contract interaction failures

### Implementation Tasks

#### Task 3.1: Smart Wallet Logger

```typescript
// Location: src/common/logging/loggers/smart-wallet-logger.ts
export class SmartWalletLogger extends BaseStructuredLogger {
  logWalletDeployment(context: SmartWalletContext, deployment: WalletDeployment): void
  logSignatureVerification(context: SmartWalletContext, verification: SignatureResult): void
  logNonceManagement(context: SmartWalletContext, nonce: NonceOperation): void
  logGasEstimation(context: SmartWalletContext, estimation: GasEstimation): void
  logContractInteraction(context: SmartWalletContext, interaction: ContractCall): void
}

interface SmartWalletContext extends BusinessContext {
  wallet_address: string
  chain_id: number
  wallet_type: 'safe' | 'biconomy' | 'kernel'
  owner_address?: string // Redacted in production
}
```

#### Task 3.2: Update Smart Wallet Services (6 Files)

**Files to Update:**

- `src/modules/smart-wallet/services/wallet-deployment.service.ts`
- `src/modules/smart-wallet/services/signature-verification.service.ts`
- `src/modules/smart-wallet/services/nonce-manager.service.ts`
- `src/modules/smart-wallet/services/gas-estimation.service.ts`
- `src/modules/smart-wallet/services/contract-interaction.service.ts`
- `src/modules/smart-wallet/services/wallet-factory.service.ts`

#### Task 3.3: Business Event Definitions

```typescript
// Smart wallet specific events to log:
export const SMART_WALLET_EVENTS = {
  WALLET_DEPLOYMENT_STARTED: 'wallet_deployment_started',
  WALLET_DEPLOYMENT_COMPLETED: 'wallet_deployment_completed',
  WALLET_DEPLOYMENT_FAILED: 'wallet_deployment_failed',
  SIGNATURE_VERIFICATION_SUCCESS: 'signature_verification_success',
  SIGNATURE_VERIFICATION_FAILED: 'signature_verification_failed',
  NONCE_CONFLICT_DETECTED: 'nonce_conflict_detected',
  NONCE_RECOVERY_ATTEMPTED: 'nonce_recovery_attempted',
  GAS_ESTIMATION_FAILED: 'gas_estimation_failed',
  CONTRACT_CALL_TIMEOUT: 'contract_call_timeout',
} as const
```

### Testing Strategy

#### Unit Tests

- **New Test Files:**
  - `src/common/logging/loggers/smart-wallet-logger.spec.ts`
  - `src/modules/smart-wallet/services/*.spec.ts` (update existing)
- **Mock blockchain interactions**
- **Verify sensitive data redaction**

#### Integration Tests

- **File:** `test/smart-wallet/logging-integration.spec.ts`
- **Test against real testnet transactions**
- **Verify log correlation across wallet operations**

### Security Considerations

- **Private Key Redaction:** Ensure no wallet private keys in logs
- **Address Masking:** Partial address logging for debugging
- **Transaction Hash Correlation:** Safe to log, aids debugging

## Risk Assessment & Mitigation

### High Risk Items

1. **Breaking Changes to Log Structure**
   - **Risk Level:** High
   - **Impact:** Monitoring dashboards, alerting rules
   - **Mitigation:**
     - Parallel logging during transition
     - Dashboard migration scripts
     - 2-week backward compatibility

2. **Performance Impact**
   - **Risk Level:** Medium
   - **Impact:** Increased log volume, processing overhead
   - **Mitigation:**
     - Performance benchmarking before/after
     - Log sampling for high-volume operations
     - Async logging where possible

3. **Test Failures**
   - **Risk Level:** Medium
   - **Impact:** Existing tests expecting old log format
   - **Mitigation:**
     - Update test expectations
     - Mock new logging interfaces
     - Comprehensive test suite updates

### Testing Phases

#### Phase 1: Development Testing (Week 1)

- Unit tests for all new components
- Local integration testing
- Performance baseline measurement

#### Phase 2: Staging Validation (Week 2)

- Deploy to staging environment
- End-to-end testing with real data flows
- Dashboard compatibility validation
- Performance impact assessment

#### Phase 3: Production Rollout (Week 2, gradual)

- Feature flags for gradual enablement
- Monitor error rates and performance
- Quick rollback capability maintained

## Success Criteria

### Quantitative Metrics

- **Test Coverage:** Maintain 85%+ overall coverage
- **Performance Impact:** <5% increase in logging overhead
- **Error Detection:** 95%+ of errors include structured context
- **APM Correlation:** 90%+ of business operations have trace correlation

### Qualitative Metrics

- All smart wallet operations have comprehensive logging
- Error troubleshooting time reduced by improved context
- Monitoring dashboards enhanced with new structured data
- Developer experience improved with consistent logging patterns

## Dependencies

### External Dependencies

- Datadog APM agent configuration
- Monitoring dashboard updates
- Alert rule adjustments

### Internal Dependencies

- No breaking changes to existing business logic
- Database migration scripts (if log storage changes)
- Configuration management updates

## Rollback Plan

### Quick Rollback (< 1 hour)

- Feature flags to disable new logging
- Revert to previous logging patterns
- Restore previous dashboard configurations

### Full Rollback (< 4 hours)

- Code revert to previous commit
- Database rollback if schema changed
- Complete monitoring stack restoration
