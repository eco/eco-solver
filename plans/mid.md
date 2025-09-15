# Medium Priority Logging Improvements Plan

**Timeline: Weeks 3-4**  
**Estimated Effort: 6-8 developer days**

## Prerequisites

- High priority improvements must be completed and stable
- Performance baseline established from high priority changes
- Monitoring dashboards updated and validated

## 1. Deploy Log Sampling for High-Volume Operations

### Objective

Implement intelligent log sampling to reduce log volume while maintaining observability for high-frequency operations.

### Current State Analysis

- Quote generation: ~1000 logs/minute in peak traffic
- Balance checks: ~2000 logs/minute
- Health checks: ~500 logs/minute
- Intent creation: ~100 logs/minute (keep 100%)

### Implementation Tasks

#### Task 1.1: Sampling Configuration System

```typescript
// Location: src/common/logging/sampling/sampling-config.ts
export interface SamplingRule {
  operation_type: string
  sample_rate: number // 0.0 to 1.0
  conditions?: SamplingCondition[]
  priority_overrides?: PriorityOverride[]
}

export interface SamplingCondition {
  field: string
  operator: 'equals' | 'contains' | 'gt' | 'lt'
  value: any
}

export interface PriorityOverride {
  condition: SamplingCondition
  sample_rate: number
  reason: string
}

export const SAMPLING_CONFIG: SamplingRule[] = [
  {
    operation_type: 'intent_creation',
    sample_rate: 1.0, // 100% - critical business events
  },
  {
    operation_type: 'quote_generation',
    sample_rate: 0.1, // 10% - high volume
    priority_overrides: [
      {
        condition: { field: 'status', operator: 'equals', value: 'error' },
        sample_rate: 1.0, // Always log errors
        reason: 'error_analysis',
      },
      {
        condition: { field: 'amount_usd', operator: 'gt', value: 10000 },
        sample_rate: 1.0, // Always log high-value transactions
        reason: 'high_value_monitoring',
      },
    ],
  },
  {
    operation_type: 'balance_check',
    sample_rate: 0.01, // 1% - very high volume
    priority_overrides: [
      {
        condition: { field: 'balance_critical', operator: 'equals', value: true },
        sample_rate: 1.0,
        reason: 'critical_balance_monitoring',
      },
    ],
  },
  {
    operation_type: 'health_check',
    sample_rate: 0.05, // 5% - routine monitoring
    priority_overrides: [
      {
        condition: { field: 'status', operator: 'equals', value: 'unhealthy' },
        sample_rate: 1.0,
        reason: 'health_issue_detection',
      },
    ],
  },
]
```

#### Task 1.2: Sampling Engine Implementation

```typescript
// Location: src/common/logging/sampling/sampling-engine.ts
export class SamplingEngine {
  private config: Map<string, SamplingRule>
  private rateLimiters: Map<string, RateLimiter>

  constructor(config: SamplingRule[]) {
    this.config = new Map(config.map((rule) => [rule.operation_type, rule]))
    this.rateLimiters = new Map()
  }

  shouldSample(operation_type: string, context: any): SamplingDecision {
    // Implement sampling logic with priority overrides
  }

  updateSamplingRates(newRates: Partial<Record<string, number>>): void {
    // Dynamic sampling rate adjustment
  }

  getSamplingStats(): SamplingStats {
    // Return current sampling statistics
  }
}

interface SamplingDecision {
  sample: boolean
  reason: string
  sample_rate_used: number
}

interface SamplingStats {
  total_logs: number
  sampled_logs: number
  sampling_rate_actual: number
  by_operation: Record<string, OperationStats>
}
```

#### Task 1.3: Update Structured Loggers

**Files to Update:**

- `src/common/logging/loggers/quote-generation-logger.ts`
- `src/common/logging/loggers/liquidity-manager-logger.ts`
- `src/common/logging/loggers/health-operation-logger.ts`
- `src/common/logging/loggers/base-structured-logger.ts`

**Integration Pattern:**

```typescript
// Add to BaseStructuredLogger:
private samplingEngine: SamplingEngine;

protected logWithSampling(
  operation_type: string,
  context: BusinessContext,
  message: string,
  level: LogLevel = 'info'
): void {
  const decision = this.samplingEngine.shouldSample(operation_type, context);

  if (decision.sample) {
    const enrichedContext = {
      ...context,
      sampling_decision: {
        sampled: true,
        reason: decision.reason,
        rate: decision.sample_rate_used
      }
    };
    this.logger[level](enrichedContext, message);
  }
}
```

### Testing Strategy

#### Unit Tests

- **New Test Files:**
  - `src/common/logging/sampling/sampling-config.spec.ts`
  - `src/common/logging/sampling/sampling-engine.spec.ts`
- **Test Scenarios:**
  - Sample rate accuracy across different operations
  - Priority override functionality
  - Rate limiter behavior
  - Configuration validation

#### Load Testing

- **File:** `test/performance/logging-sampling.spec.ts`
- **Scenarios:**
  - High-volume log generation (10k logs/min)
  - Memory usage with sampling enabled
  - CPU impact measurement
  - Sampling accuracy under load

#### Integration Tests

- **File:** `test/logging/sampling-integration.spec.ts`
- **Scenarios:**
  - End-to-end sampling across services
  - Dynamic sampling rate adjustment
  - Monitoring dashboard data consistency

### Potential Breaking Changes

- **Risk:** Reduced log volume may impact existing monitoring
- **Mitigation:**
  - Gradual rollout with monitoring
  - Adjustable sampling rates via configuration
  - Sampling bypass for critical operations

## 2. Complete Transaction Lifecycle Logging

### Objective

Ensure comprehensive logging coverage for all transaction states and blockchain interactions.

### Current Coverage Gaps Analysis

```typescript
// Missing transaction states:
interface TransactionLifecycleGaps {
  transaction_submitted: boolean // ✅ Covered
  transaction_pending: boolean // ❌ Missing
  transaction_confirmed: boolean // ✅ Covered
  transaction_failed: boolean // ❌ Missing (partial)
  transaction_replaced: boolean // ❌ Missing
  transaction_dropped: boolean // ❌ Missing
  gas_price_updates: boolean // ❌ Missing
  nonce_reused: boolean // ❌ Missing
  block_reorg_impact: boolean // ❌ Missing
}
```

### Implementation Tasks

#### Task 2.1: Transaction Lifecycle Logger

```typescript
// Location: src/common/logging/loggers/transaction-lifecycle-logger.ts
export class TransactionLifecycleLogger extends BaseStructuredLogger {
  logTransactionSubmitted(context: TransactionContext, tx: TransactionData): void
  logTransactionPending(context: TransactionContext, pendingInfo: PendingTransactionInfo): void
  logTransactionConfirmed(context: TransactionContext, receipt: TransactionReceipt): void
  logTransactionFailed(context: TransactionContext, failure: TransactionFailure): void
  logTransactionReplaced(context: TransactionContext, replacement: TransactionReplacement): void
  logTransactionDropped(context: TransactionContext, reason: DropReason): void
  logGasPriceUpdate(context: TransactionContext, gasUpdate: GasUpdate): void
  logNonceReuse(context: TransactionContext, nonceIssue: NonceIssue): void
  logBlockReorgImpact(context: TransactionContext, reorg: BlockReorg): void
}

interface TransactionContext extends BusinessContext {
  transaction_hash?: string
  chain_id: number
  from_address: string // Partially redacted
  to_address?: string
  nonce: number
  gas_limit: string
  gas_price: string
  intent_hash?: string // Correlation to business operation
  wallet_type: 'eoa' | 'smart_wallet'
}
```

#### Task 2.2: Transaction State Machine Integration

```typescript
// Location: src/modules/blockchain/services/transaction-monitor.service.ts
export class TransactionMonitorService {
  private lifecycleLogger: TransactionLifecycleLogger
  private stateTransitions: Map<string, TransactionState>

  async monitorTransaction(txHash: string, context: TransactionContext): Promise<void> {
    // Enhanced monitoring with comprehensive logging
    this.lifecycleLogger.logTransactionSubmitted(context, initialTx)

    // Set up state change listeners
    this.setupStateChangeListeners(txHash, context)
  }

  private setupStateChangeListeners(txHash: string, context: TransactionContext): void {
    this.blockchain.on('transactionUpdate', (update) => {
      this.handleStateTransition(txHash, context, update)
    })
  }

  private handleStateTransition(
    txHash: string,
    context: TransactionContext,
    update: TransactionUpdate,
  ): void {
    const previousState = this.stateTransitions.get(txHash)
    const newState = update.state

    // Log state transitions with comprehensive context
    switch (newState) {
      case TransactionState.PENDING:
        this.lifecycleLogger.logTransactionPending(context, {
          confirmations: update.confirmations,
          block_number: update.blockNumber,
          gas_used_estimate: update.gasUsedEstimate,
        })
        break

      case TransactionState.CONFIRMED:
        this.lifecycleLogger.logTransactionConfirmed(context, update.receipt)
        break

      case TransactionState.FAILED:
        this.lifecycleLogger.logTransactionFailed(context, {
          error_reason: update.errorReason,
          revert_reason: update.revertReason,
          gas_used: update.gasUsed,
        })
        break

      case TransactionState.REPLACED:
        this.lifecycleLogger.logTransactionReplaced(context, {
          replacement_hash: update.replacementHash,
          replacement_type: update.replacementType, // 'speed_up' | 'cancel'
          new_gas_price: update.newGasPrice,
        })
        break

      case TransactionState.DROPPED:
        this.lifecycleLogger.logTransactionDropped(context, {
          reason: update.dropReason,
          final_nonce: update.finalNonce,
          blocks_pending: update.blocksPending,
        })
        break
    }
  }
}
```

#### Task 2.3: Enhanced Blockchain Event Monitoring

**Files to Update:**

- `src/modules/blockchain/services/blockchain-monitor.service.ts`
- `src/modules/blockchain/services/gas-tracker.service.ts`
- `src/modules/blockchain/services/nonce-manager.service.ts`

**New Event Types:**

```typescript
export const TRANSACTION_EVENTS = {
  // Existing events (keep)
  TRANSACTION_SUBMITTED: 'transaction_submitted',
  TRANSACTION_CONFIRMED: 'transaction_confirmed',

  // New events to add
  TRANSACTION_PENDING: 'transaction_pending',
  TRANSACTION_FAILED: 'transaction_failed',
  TRANSACTION_REPLACED: 'transaction_replaced',
  TRANSACTION_DROPPED: 'transaction_dropped',
  GAS_PRICE_UPDATED: 'gas_price_updated',
  NONCE_CONFLICT: 'nonce_conflict',
  BLOCK_REORG_DETECTED: 'block_reorg_detected',
  TRANSACTION_STUCK: 'transaction_stuck', // >10 minutes pending
  TRANSACTION_UNDERPRICED: 'transaction_underpriced',
} as const
```

### Testing Strategy

#### Unit Tests

- **New Test Files:**
  - `src/common/logging/loggers/transaction-lifecycle-logger.spec.ts`
  - `src/modules/blockchain/services/transaction-monitor.service.spec.ts`
- **Mock blockchain events and state transitions**
- **Verify all transaction states are logged correctly**

#### Integration Tests

- **File:** `test/blockchain/transaction-lifecycle.spec.ts`
- **Test against testnets:**
  - Submit transactions with different gas prices
  - Test transaction replacement scenarios
  - Verify block reorg handling
  - Test nonce conflict resolution

#### Chaos Testing

- **File:** `test/chaos/blockchain-disruption.spec.ts`
- **Scenarios:**
  - Network partitions during transaction processing
  - Rapid gas price changes
  - Multiple transaction replacements
  - Block reorgs affecting pending transactions

## 3. Enhance API Boundary Logging

### Objective

Implement comprehensive logging for all API interactions, both incoming requests and outgoing calls to external services.

### Current Coverage Gaps

- Request/response correlation missing for many endpoints
- External API call failures not consistently logged
- Rate limiting violations not tracked
- API performance metrics incomplete

### Implementation Tasks

#### Task 3.1: API Request/Response Logger

```typescript
// Location: src/common/logging/loggers/api-boundary-logger.ts
export class ApiBoundaryLogger extends BaseStructuredLogger {
  logIncomingRequest(context: ApiRequestContext, request: IncomingRequest): void
  logOutgoingRequest(context: ApiRequestContext, request: OutgoingRequest): void
  logApiResponse(context: ApiRequestContext, response: ApiResponse): void
  logApiError(context: ApiRequestContext, error: ApiError): void
  logRateLimitViolation(context: ApiRequestContext, violation: RateLimitViolation): void
  logApiPerformance(context: ApiRequestContext, metrics: ApiPerformanceMetrics): void
}

interface ApiRequestContext extends BusinessContext {
  request_id: string
  method: string
  endpoint: string
  user_agent?: string
  ip_address?: string // Hashed for privacy
  api_version?: string
  correlation_id?: string
}

interface OutgoingRequest {
  service_name: string
  endpoint: string
  method: string
  timeout_ms: number
  retry_attempt?: number
  circuit_breaker_state?: 'closed' | 'open' | 'half_open'
}

interface ApiPerformanceMetrics {
  response_time_ms: number
  payload_size_bytes: number
  database_queries?: number
  external_calls?: number
  cache_hits?: number
  cache_misses?: number
}
```

#### Task 3.2: API Middleware Enhancement

```typescript
// Location: src/common/middleware/api-logging.middleware.ts
@Injectable()
export class ApiLoggingMiddleware implements NestMiddleware {
  private apiBoundaryLogger: ApiBoundaryLogger

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now()
    const requestId = uuidv4()

    // Enhanced request context
    const context: ApiRequestContext = {
      request_id: requestId,
      method: req.method,
      endpoint: this.sanitizeEndpoint(req.path),
      user_agent: this.hashUserAgent(req.get('User-Agent')),
      ip_address: this.hashIpAddress(req.ip),
      api_version: req.get('API-Version'),
      correlation_id: req.get('X-Correlation-ID'),
      // Business context extraction
      user_id: req.user?.id,
      session_id: req.session?.id,
    }

    // Log incoming request
    this.apiBoundaryLogger.logIncomingRequest(context, {
      headers: this.sanitizeHeaders(req.headers),
      query_params: req.query,
      body_size: req.get('Content-Length'),
      auth_type: this.detectAuthType(req),
    })

    // Enhanced response logging
    res.on('finish', () => {
      const responseTime = Date.now() - startTime

      this.apiBoundaryLogger.logApiResponse(context, {
        status_code: res.statusCode,
        response_time_ms: responseTime,
        response_size: res.get('Content-Length'),
        cache_status: res.get('X-Cache-Status'),
      })

      // Performance metrics logging
      this.apiBoundaryLogger.logApiPerformance(context, {
        response_time_ms: responseTime,
        payload_size_bytes: parseInt(res.get('Content-Length') || '0'),
        // Add custom metrics from request context
        ...this.extractPerformanceMetrics(req),
      })
    })

    next()
  }
}
```

#### Task 3.3: External API Call Logging

**Files to Update:**

- `src/modules/external-apis/services/lifi-api.service.ts`
- `src/modules/external-apis/services/squid-api.service.ts`
- `src/modules/external-apis/services/blockchain-api.service.ts`
- `src/modules/external-apis/services/price-feed.service.ts`

**Enhanced HTTP Client Pattern:**

```typescript
// Location: src/common/http/logged-http.service.ts
@Injectable()
export class LoggedHttpService {
  private apiBoundaryLogger: ApiBoundaryLogger
  private httpService: HttpService

  async request<T>(config: AxiosRequestConfig): Promise<T> {
    const context = this.createApiContext(config)
    const startTime = Date.now()

    try {
      this.apiBoundaryLogger.logOutgoingRequest(context, {
        service_name: this.extractServiceName(config.baseURL),
        endpoint: config.url,
        method: config.method?.toUpperCase() || 'GET',
        timeout_ms: config.timeout || 5000,
        retry_attempt: config.metadata?.retryAttempt || 0,
      })

      const response = await this.httpService.request(config).toPromise()

      this.apiBoundaryLogger.logApiResponse(context, {
        status_code: response.status,
        response_time_ms: Date.now() - startTime,
        response_size: JSON.stringify(response.data).length,
        headers: this.sanitizeResponseHeaders(response.headers),
      })

      return response.data
    } catch (error) {
      this.apiBoundaryLogger.logApiError(context, {
        error_type: this.classifyApiError(error),
        status_code: error.response?.status,
        error_message: error.message,
        response_time_ms: Date.now() - startTime,
        retry_eligible: this.isRetryEligible(error),
      })

      throw error
    }
  }
}
```

### Testing Strategy

#### Unit Tests

- **New Test Files:**
  - `src/common/logging/loggers/api-boundary-logger.spec.ts`
  - `src/common/middleware/api-logging.middleware.spec.ts`
  - `src/common/http/logged-http.service.spec.ts`
- **Mock HTTP requests/responses**
- **Verify sensitive data redaction**
- **Test performance metrics accuracy**

#### Integration Tests

- **File:** `test/api/boundary-logging.spec.ts`
- **Scenarios:**
  - Full request/response cycle logging
  - External API call monitoring
  - Error handling and retry logging
  - Rate limiting detection

#### Performance Tests

- **File:** `test/performance/api-logging-overhead.spec.ts`
- **Measure logging overhead on API response times**
- **Test high-concurrency scenarios**

### Potential Breaking Changes

- **Risk:** Middleware changes may affect request processing
- **Mitigation:**
  - Gradual rollout by endpoint
  - Performance monitoring during deployment
  - Quick disable capability via feature flag

## Risk Assessment & Mitigation

### Medium Risk Items

1. **Log Volume Increase**
   - **Risk Level:** Medium
   - **Impact:** Higher storage costs, potential performance impact
   - **Mitigation:**
     - Intelligent sampling implementation
     - Cost monitoring and alerts
     - Retention policy optimization

2. **External API Monitoring Impact**
   - **Risk Level:** Medium
   - **Impact:** Slight increase in API call latency
   - **Mitigation:**
     - Async logging where possible
     - Batch log submissions
     - Circuit breaker for logging failures

3. **Test Suite Complexity**
   - **Risk Level:** Low-Medium
   - **Impact:** More complex mocking requirements
   - **Mitigation:**
     - Reusable test utilities
     - Mock service standardization
     - Clear testing documentation

### Testing Phases

#### Phase 1: Feature Development (Week 3)

- Unit tests for all new components
- Local integration testing
- Performance impact assessment

#### Phase 2: Integration Testing (Week 4)

- Deploy to staging environment
- Load testing with realistic traffic
- End-to-end API boundary testing
- Transaction lifecycle validation

#### Phase 3: Production Deployment (Gradual)

- Sampling: Deploy with conservative rates first
- Transaction logging: Enable per chain gradually
- API logging: Enable per service gradually

## Success Criteria

### Quantitative Metrics

- **Log Volume Reduction:** 60-80% reduction in high-volume operations
- **Transaction Coverage:** 100% of transaction states logged
- **API Coverage:** 95%+ of external API calls logged
- **Performance Impact:** <3% increase in API response times

### Qualitative Metrics

- Improved debugging capability for transaction issues
- Better external API reliability monitoring
- Reduced alert noise through intelligent sampling
- Enhanced business intelligence from API metrics

## Dependencies

### Prerequisites from High Priority

- Error logging standardization completed
- APM trace correlation working
- Smart wallet logging operational

### External Dependencies

- No additional external services required
- Configuration management for sampling rules
- Monitoring dashboard updates for new metrics

## Rollback Plan

### Immediate Rollback (< 30 minutes)

- Feature flags to disable sampling
- Disable enhanced API logging middleware
- Revert to previous transaction monitoring

### Full Rollback (< 2 hours)

- Code revert to previous stable version
- Configuration rollback
- Monitoring dashboard restoration
- Alert rule restoration

## Configuration Management

### Environment-Specific Settings

```yaml
# Development
sampling:
  enabled: false # Keep all logs in dev

# Staging
sampling:
  enabled: true
  quote_generation: 0.5 # Higher rate for testing

# Production
sampling:
  enabled: true
  quote_generation: 0.1
  balance_check: 0.01
  health_check: 0.05
```

### Dynamic Configuration

- Runtime sampling rate adjustment via admin API
- Circuit breaker configuration for external API logging
- Performance threshold adjustments without deployment
