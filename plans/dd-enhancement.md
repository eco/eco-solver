# Datadog Analytics Enhancement for EcoLogMessage

## Current State Analysis

### Existing EcoLogMessage Implementation
The current `EcoLogMessage` class (`src/common/logging/eco-log-message.ts`) provides basic structured logging with:
- Message content with optional properties
- User ID association (`withUser`)  
- Error logging (`withError`, `withErrorAndUser`, `withErrorAndId`)
- ID-based logging (`withId`, `withErrorAndId`)

**Current Output Structure:**
```json
{
  "msg": "Log message text",
  "userID": "optional-user-id",
  "error": "error.toString()", 
  "id": "optional-id",
  "...properties": "additional custom properties"
}
```

### Usage Patterns
- Primarily used in NestJS services, processors, and controllers
- Common usage: `this.logger.debug(EcoLogMessage.fromDefault({...}))`
- Heavy usage in BullMQ processors, liquidity managers, intent services
- Currently lacks standardized field naming and data structure

## Datadog Structured Logging Best Practices

### Key Requirements for Analytics Dashboards
1. **JSON Format**: All logs must be in JSON format with consistent structure
2. **Reserved Attributes**: Use Datadog's reserved attributes for proper parsing
3. **High-Cardinality Data**: Enable analysis by quote ID, request ID, etc.
4. **Consistent Field Names**: Standardized naming for filtering and grouping
5. **Proper Data Types**: Ensure numbers, timestamps, and booleans are typed correctly
6. **Index Strategy**: Structure data to support efficient querying and visualization

### Datadog Reserved Attributes
- `message`: Log body content (indexed for full-text search)
- `host`: Hostname (automatically set by Agent)
- `service`: Service name (critical for APM correlation)
- `status`: Log level (DEBUG, INFO, WARN, ERROR)
- `ddsource`: Log source identification
- `ddtags`: Tags for log organization
- `trace_id`: Trace ID for APM correlation
- `@timestamp`: ISO 8601 timestamp
- `env`: Environment (prod, staging, dev)
- `version`: Application version

## Enhancement Proposal

### 1. Core Structure Improvements

**Enhanced Base Structure:**
```json
{
  "@timestamp": "2025-01-15T10:30:00.000Z",
  "message": "Human-readable log message",
  "service": "eco-solver",
  "status": "info",
  "ddsource": "nodejs",
  "ddtags": "env:production,service:eco-solver",
  "host": "eco-solver-pod-123",
  "env": "production",
  "version": "1.5",
  "logger.name": "InboxProcessor",
  "trace_id": "trace-id-123"
}
```

### 2. Business Context Fields

**Core Business Identifiers:**
```json
{
  "eco": {
    "intent_hash": "string",
    "quote_id": "string",
    "rebalance_id": "string",
    "transaction_hash": "string",
    "request_id": "string",
    "wallet_address": "string",
    "creator": "string",
    "prover": "string",
    "funder": "string",
    "inbox": "string",
    "d_app_id": "string",
    "group_id": "string",
    "source_chain_id": "number",
    "destination_chain_id": "number",
    "strategy": "string",
    "intent_execution_type": "string",
    "rejection_reason": "string"
  }
}
```

**Operation Context:**
```json
{
  "operation": {
    "type": "intent_creation|fulfillment|rebalancing|quote_generation",
    "status": "started|in_progress|completed|failed",
    "duration_ms": "number",
    "retry_count": "number",
    "correlation_id": "string"
  }
}
```

### 3. Financial/Liquidity Metrics

**For Analytics Dashboards:**
```json
{
  "metrics": {
    "amount_in": "string",
    "amount_out": "string",
    "native_value": "string",
    "swap_amount": "number",
    "slippage": "number",
    "deadline": "number",
    "current_balance": "number",
    "target_balance": "number",
    "token_in_address": "string",
    "token_out_address": "string",
    "fee_amount": "string",
    "gas_used": "number",
    "gas_price": "string",
    "execution_price": "string"
  }
}
```

### 4. Error Enrichment

**Enhanced Error Structure:**
```json
{
  "error": {
    "kind": "string",
    "message": "string",
    "stack": "string", 
    "code": "string|number",
    "recoverable": "boolean",
    "upstream_service": "string",
    "retry_after": "number"
  },
  "status": "error",
  "logger": {
    "name": "service.class",
    "method_name": "methodName",
    "thread_name": "main"
  }
}
```

### 5. Performance Metrics

**For SLA Monitoring:**
```json
{
  "performance": {
    "response_time_ms": "number",
    "queue_depth": "number", 
    "cpu_usage": "number",
    "memory_usage": "number",
    "active_connections": "number"
  }
}
```

## Implementation Plan

### Phase 1: Enhanced EcoLogMessage Class

1. **Add Datadog Integration**
   - Automatic reserved attributes injection (message, service, status, host)
   - Environment and source detection (env, ddsource)
   - APM trace correlation (trace_id)
   - Tag management (ddtags)
   - JSON size validation (256 attributes, 25KB limit)
   - Multi-line log detection support

2. **Enhanced EcoLogMessage Factory Methods**
   ```typescript
   EcoLogMessage.forIntentOperation(params: IntentOperationLogParams)
   EcoLogMessage.forLiquidityOperation(params: LiquidityOperationLogParams)  
   EcoLogMessage.forQuoteGeneration(params: QuoteGenerationLogParams)
   EcoLogMessage.forPerformanceMetric(params: PerformanceMetricLogParams)
   EcoLogMessage.forHealthOperation(params: HealthOperationLogParams)
   EcoLogMessage.forGenericOperation(params: GenericOperationLogParams)
   ```

3. **Specialized Logger Wrapper Classes**
   ```typescript
   class LiquidityManagerLogger extends EcoLogger {
     log(context: LiquidityManagerLogContext, message: string, properties?: object)
     error(context: LiquidityManagerLogContext, message: string, error?: Error, properties?: object)
     warn(context: LiquidityManagerLogContext, message: string, properties?: object)
     debug(context: LiquidityManagerLogContext, message: string, properties?: object)
   }
   
   class IntentOperationLogger extends EcoLogger {
     log(context: IntentOperationLogContext, message: string, properties?: object)
     error(context: IntentOperationLogContext, message: string, error?: Error, properties?: object)
     warn(context: IntentOperationLogContext, message: string, properties?: object)
     debug(context: IntentOperationLogContext, message: string, properties?: object)
   }
   
   class QuoteGenerationLogger extends EcoLogger {
     log(context: QuoteGenerationLogContext, message: string, properties?: object)
     error(context: QuoteGenerationLogContext, message: string, error?: Error, properties?: object)
     warn(context: QuoteGenerationLogContext, message: string, properties?: object)
     debug(context: QuoteGenerationLogContext, message: string, properties?: object)
   }
   
   class HealthOperationLogger extends EcoLogger {
     log(context: HealthOperationLogContext, message: string, properties?: object)
     error(context: HealthOperationLogContext, message: string, error?: Error, properties?: object)
     warn(context: HealthOperationLogContext, message: string, properties?: object)
     debug(context: HealthOperationLogContext, message: string, properties?: object)
   }
   ```

4. **Context Interfaces for Factory Methods**
   ```typescript
   interface IntentOperationLogParams {
     message: string
     intentHash: string
     quoteId?: string
     creator?: string
     prover?: string
     funder?: string
     inbox?: string
     dAppId?: string
     sourceChainId?: number
     destinationChainId?: number
     tokenInAddress?: string
     tokenOutAddress?: string
     amountIn?: string
     amountOut?: string
     nativeValue?: string
     deadline?: number
     intentExecutionType?: 'gasless' | 'standard'
     operationType: 'creation' | 'fulfillment' | 'validation' | 'funding'
     status: 'started' | 'completed' | 'failed'
     properties?: object
   }
   
   interface LiquidityOperationLogParams {
     message: string
     rebalanceId: string
     walletAddress: string
     strategy: 'LiFi' | 'Stargate' | 'CCTP' | 'CCTP_V2' | 'Gateway' | 'Everclear' | 'Hyperlane' | 'Relay' | 'Squid'
     sourceChainId?: number
     destinationChainId?: number
     tokenInAddress?: string
     tokenOutAddress?: string
     amountIn?: string
     amountOut?: string
     slippage?: number
     groupId?: string
     operationType: 'rebalancing' | 'liquidity_provision' | 'withdrawal' | 'quote_rejection'
     status: 'pending' | 'completed' | 'failed' | 'rejected'
     rejectionReason?: 'HIGH_SLIPPAGE' | 'PROVIDER_ERROR' | 'INSUFFICIENT_LIQUIDITY' | 'TIMEOUT'
     properties?: object
   }
   
   interface HealthOperationLogParams {
     message: string
     healthCheck: string
     status: 'healthy' | 'unhealthy' | 'degraded'
     responseTime?: number
     dependencies?: string[]
     properties?: object
   }
   
   interface GenericOperationLogParams {
     message: string
     operationType: string
     status?: string
     duration?: number
     properties?: object
   }
   ```

5. **Context Interfaces for Wrapper Classes**
   ```typescript
   interface LiquidityManagerLogContext {
     rebalanceId: string
     walletAddress: string
     strategy: 'LiFi' | 'Stargate' | 'CCTP' | 'CCTP_V2' | 'Gateway' | 'Everclear' | 'Hyperlane' | 'Relay' | 'Squid'
     sourceChainId?: number
     destinationChainId?: number
     tokenInAddress?: string
     tokenOutAddress?: string
     groupId?: string
   }
   
   interface IntentOperationLogContext {
     intentHash: string
     quoteId?: string
     creator?: string
     dAppId?: string
     sourceChainId?: number
     destinationChainId?: number
     operationType?: 'creation' | 'fulfillment' | 'validation' | 'funding'
   }
   
   interface QuoteGenerationLogContext {
     quoteId: string
     intentHash?: string
     dAppId?: string
     sourceChainId?: number
     destinationChainId?: number
     tokenInAddress?: string
     tokenOutAddress?: string
     intentExecutionType?: 'gasless' | 'standard'
   }
   
   interface HealthOperationLogContext {
     healthCheck: string
     dependencies?: string[]
   }
   ```

### Phase 2: Wrapper Logger Implementation

1. **Create Specialized Logger Classes**
   - `LiquidityManagerLogger` for liquidity management operations
   - `IntentOperationLogger` for intent-related operations
   - `QuoteGenerationLogger` for quote generation processes
   - `HealthOperationLogger` for health check operations

2. **Context Interface Implementation**
   - Define required context fields for each domain
   - Implement context validation and merging
   - Create factory method integration

3. **Service Integration**
   - Refactor `liquidity-manager.service.ts`
   - Update `liquidity-provider.service.ts`
   - Modify `*JobManager` classes
   - Update intent services and quote services

### Phase 3: Standardized Field Schema

1. **Create Schema Definitions**
   - Business context schema
   - Error schema  
   - Performance metrics schema
   - Financial transaction schema

2. **Field Validation & Size Limits**
   - **Max 256 attributes per log event**
   - **Max 50 characters per attribute key**
   - **Max 20 nested levels**
   - **Max 1024 characters per attribute value (for faceted fields)**
   - **Max log size: 25KB (recommended)**
   - Type checking for critical fields
   - Required field validation
   - Data format validation (addresses, amounts, etc.)

### Phase 4: Dashboard Optimization

1. **Index Strategy**
   - **Faceted Attributes** (high-cardinality): intent_hash, quote_id, rebalance_id, wallet_address, creator, prover, funder, group_id, request_id
   - **Standard Filters** (medium-cardinality): strategy, intent_execution_type, rejection_reason, operation_type, status, source_chain_id, destination_chain_id, token_in_address, token_out_address, d_app_id
   - **Reserved Attributes** (low-cardinality): service, env, ddsource, host
   - **Size Consideration**: Faceted fields limited to 1024 characters

2. **Facet Creation & Processing Pipeline**
   - **Business metrics facets** (amounts, fees, execution times)
   - **Performance KPI facets** (response times, queue depths)
   - **Error categorization facets** (error.kind, error.code)
   - **Custom Processors**: Date remappers, status remappers
   - **Grok Parsers**: For complex log format parsing
   - **Lookup Processors**: For enrichment with external data

3. **Pre-built Query Patterns**
   - Intent success rates by chain
   - Average fulfillment times
   - Error distribution by service
   - Liquidity provider performance
   - Request flow tracking
   - Health check status monitoring

### Phase 5: Analytics Enablement

1. **Dashboard Templates**
   - Executive KPI dashboard
   - Operational health dashboard
   - User experience dashboard  
   - Financial metrics dashboard

2. **Alert Definitions**
   - SLA breach alerts
   - Error rate thresholds
   - Performance degradation alerts
   - Business metric anomalies

## Expected Benefits

### For Analytics Teams
- **Standardized Queries**: Consistent field names enable reusable query patterns
- **High-Cardinality Analysis**: Track individual request flows and intent lifecycles using faceted attributes
- **Real-time Insights**: Live dashboards with business KPIs leveraging Datadog Log Explorer
- **Correlation Analysis**: APM correlation through trace_id linking logs to distributed traces
- **Advanced Processing**: Custom processors for log enrichment and parsing

### for Engineering Teams
- **Debugging**: Rich context for error investigation with structured error.kind and error.stack
- **Performance Monitoring**: Detailed performance metrics per operation within size limits
- **Service Health**: Real-time service status and dependency tracking via reserved attributes
- **Release Impact**: Version-based performance comparison using version field
- **Multi-line Support**: Automatic detection of complex log structures

### For Business Teams
- **Service Analytics**: Request patterns and conversion funnels through faceted search
- **Revenue Metrics**: Transaction volumes, fees, and profitability (respecting 1024 char limit)
- **Market Intelligence**: Cross-chain activity patterns via indexed business context
- **Operational Efficiency**: Process optimization through pipeline processors and analytics
- **Data Protection**: Sensitive Data Scanner for compliance and security

## Migration Strategy

### Phase 1: Enhanced EcoLogMessage (Week 1-2)
- Extend existing EcoLogMessage without breaking changes
- Add new factory methods with business context
- Deploy with feature flags

### Phase 2: Wrapper Logger Classes (Week 3-4)
- Implement `LiquidityManagerLogger` and other specialized loggers
- Create context interfaces and validation
- Unit test wrapper functionality

### Phase 3: Service Migration (Week 5-8)  
- Start with Liquidity Manager services (requirement focus)
- Migrate intent processors and quote services
- Update BullMQ processors and job managers
- Validate structured logging output

### Phase 4: Schema Enforcement (Week 9-10)
- Add field validation and type checking
- Optimize Datadog indexes and facets
- Deprecate old unstructured logging patterns

### Phase 5: Advanced Analytics (Week 11-12)
- Deploy pre-built dashboards
- Configure alerting rules
- Enable Log Workspaces for advanced analysis

## Success Metrics

- **Query Performance**: 50% reduction in dashboard load times
- **Analytics Adoption**: 90% of business questions answerable through dashboards
- **Debugging Efficiency**: 75% reduction in time to identify root causes
- **Alert Precision**: 95% alert accuracy with minimal false positives