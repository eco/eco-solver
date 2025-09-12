# Structured JSON Logging System Documentation

## Overview

This guide covers how to use the structured JSON logging system that provides rich, Datadog-optimized logging with automatic context extraction, performance tracking, and business domain awareness.

## Architecture

The logging system is built around decorators and specialized loggers that automatically capture operation context, timing, and business-specific metadata:

```
src/common/logging/
├── decorators/           # @LogOperation, @LogSubOperation, @LogContext
├── loggers/             # Specialized domain loggers
├── types.ts             # TypeScript interfaces
├── validation.ts        # Datadog schema validation
└── eco-log-message.ts   # Core message formatting
```

## Quick Start

### Basic Service Logging

#### 1. Method-Level Operation Logging

```typescript
import { LogOperation } from '@/common/logging/decorators'
import { QuoteGenerationLogger } from '@/common/logging/loggers'

export class QuoteService {
  @LogOperation('quote_generation', QuoteGenerationLogger)
  async generateQuote(
    @LogContext tokenIn: TokenConfig,
    @LogContext tokenOut: TokenConfig,
    amount: number,
  ): Promise<Quote> {
    // Your business logic here
    // Automatic logging of entry, success/failure, timing, and context
    return quote
  }
}
```

**What this provides:**

- Automatic entry/exit logging with timing
- Error handling and stack traces
- Business context extraction (token info, amounts, etc.)
- Datadog-optimized field structure
- Operation correlation IDs

#### 2. Sub-Operation Tracking

```typescript
export class LiquidityManagerService {
  @LogOperation('liquidity_analysis', LiquidityManagerLogger)
  async analyzeTokens(walletAddress: string): Promise<TokenAnalysis> {
    // Main operation logged automatically

    const reservedAmounts = await this.getReservedAmounts(walletAddress)
    const analysis = this.performAnalysis(reservedAmounts)

    return analysis
  }

  @LogSubOperation('reserved_token_mapping')
  private async getReservedAmounts(walletAddress: string): Promise<Map<string, bigint>> {
    // Sub-operation logged with parent context inheritance
    return await this.repository.getPendingReserved(walletAddress)
  }
}
```

#### 3. Custom Context Extraction

```typescript
import { LogContext } from '@/common/logging/decorators'

export class IntentService {
  @LogOperation('intent_validation', IntentOperationLogger)
  async validateIntent(
    @LogContext('intent') intent: Intent, // Custom context key
    @LogContext('wallet') walletAddress: string,
  ): Promise<ValidationResult> {
    // Context automatically extracted and included in logs
    return validation
  }
}
```

## Specialized Loggers

### 1. Quote Generation Logger

For quote-related operations:

```typescript
@LogOperation('quote_request', QuoteGenerationLogger)
async getQuote(request: QuoteRequest): Promise<Quote> {
  // Automatically logs:
  // - quote_id
  // - d_app_id
  // - source_chain_id / destination_chain_id
  // - token_in / token_out addresses
  // - amount_in / amount_out
  // - slippage information
  // - execution_type (GASLESS, SELF_PUBLISH, etc.)
}
```

### 2. Liquidity Manager Logger

For liquidity management operations:

```typescript
@LogOperation('rebalance_execution', LiquidityManagerLogger)
async executeRebalance(@LogContext quote: RebalanceQuote): Promise<Receipt> {
  // Automatically logs:
  // - rebalance_id
  // - wallet_address
  // - token_in / token_out info
  // - provider_strategy (LiFi, CCTP, etc.)
  // - amount_in / amount_out
  // - slippage_actual
  // - gas_used
}
```

### 3. Intent Operation Logger

For intent processing:

```typescript
@LogOperation('intent_fulfillment', IntentOperationLogger)
async fulfillIntent(@LogContext intent: Intent): Promise<FulfillmentResult> {
  // Automatically logs:
  // - intent_hash
  // - reward_amount
  // - execution_type
  // - source/destination chain info
  // - fulfillment_strategy
}
```

### 4. Transaction Logger

For transaction operations:

```typescript
@LogOperation('transaction_execution', TransactionLogger)
async executeTransaction(@LogContext tx: TransactionRequest): Promise<Receipt> {
  // Automatically logs:
  // - tx_hash
  // - chain_id
  // - gas_used
  // - gas_price
  // - wallet_address
  // - tx_status
}
```

### 5. Health Operation Logger

For health checks and monitoring:

```typescript
@LogOperation('health_check', HealthOperationLogger)
async checkSystemHealth(): Promise<HealthStatus> {
  // Automatically logs:
  // - health_status
  // - component_statuses
  // - response_time
  // - resource_usage
}
```

### 6. Generic Operation Logger

For operations that don't fit other categories:

```typescript
@LogOperation('data_processing', GenericOperationLogger)
async processData(@LogContext data: ProcessingData): Promise<Result> {
  // Provides basic operation logging with custom context
}
```

## Manual Logging (When Decorators Can't Be Used)

For scenarios where decorators aren't suitable:

```typescript
import { createEcoLogMessage } from '@/common/logging'

export class SomeService {
  private logger = new Logger(SomeService.name)

  async complexOperation() {
    const startTime = Date.now()
    const operationId = generateId()

    try {
      // Your business logic here

      const logMessage = createEcoLogMessage({
        message: 'Complex operation completed',
        operation: {
          id: operationId,
          type: 'complex_operation',
          status: 'completed',
        },
        performance: {
          duration_ms: Date.now() - startTime,
        },
        business_context: {
          // Your domain-specific data
          user_id: 'user123',
          operation_count: 5,
        },
      })

      this.logger.log(logMessage)
    } catch (error) {
      const logMessage = createEcoLogMessage({
        message: 'Complex operation failed',
        operation: {
          id: operationId,
          type: 'complex_operation',
          status: 'failed',
        },
        performance: {
          duration_ms: Date.now() - startTime,
        },
        error: {
          type: error.constructor.name,
          message: error.message,
          stack: error.stack,
        },
      })

      this.logger.error(logMessage)
      throw error
    }
  }
}
```

## Creating Custom Specialized Loggers

When you need domain-specific logging for new business areas:

```typescript
import { BaseStructuredLogger } from '@/common/logging/loggers/base-structured-logger'

export class CustomOperationLogger extends BaseStructuredLogger {
  protected extractBusinessContext(args: any[], result?: any) {
    const [request, options] = args

    return {
      // Extract your domain-specific fields
      custom_field: request?.customProperty,
      operation_type: this.determineOperationType(request),
      user_segment: request?.userSegment,
      feature_flags: options?.featureFlags,

      // Include result data if relevant
      ...(result && {
        result_size: result?.items?.length,
        processing_mode: result?.mode,
      }),
    }
  }

  protected getDatadogTags(): string[] {
    return ['service:custom-service', 'operation:custom', 'env:' + process.env.NODE_ENV]
  }

  protected sanitizeForDatadog(obj: any): any {
    // Custom sanitization logic for your domain
    return super.sanitizeForDatadog(obj)
  }
}
```

## Best Practices

### 1. Context Over Content

```typescript
// ✅ Good: Rich context automatically captured
@LogOperation('user_action', UserActionLogger)
async processUser(@LogContext user: User, @LogContext action: Action) {
  // Business context automatically extracted
}

// ❌ Avoid: Manual string logging loses structure
async processUser(user: User) {
  this.logger.log(`Processing user ${user.id} with action ${action.type}`)
}
```

### 2. Use Appropriate Logger Types

Choose the most specific logger for your operation:

```typescript
// ✅ Financial operations
@LogOperation('quote_generation', QuoteGenerationLogger)

// ✅ Liquidity management
@LogOperation('rebalance_execution', LiquidityManagerLogger)

// ✅ Intent processing
@LogOperation('intent_validation', IntentOperationLogger)

// ✅ Generic operations (fallback)
@LogOperation('data_processing', GenericOperationLogger)
```

### 3. Leverage Sub-Operations for Complex Workflows

```typescript
@LogOperation('complex_workflow', GenericOperationLogger)
async complexWorkflow() {
  const data = await this.fetchData()      // Sub-operation 1
  const processed = await this.process(data)  // Sub-operation 2
  return await this.finalize(processed)    // Sub-operation 3
}

@LogSubOperation('data_fetch')
private async fetchData() {
  // Inherits parent operation context
  // Adds its own timing and status
}

@LogSubOperation('data_processing')
private async process(data: any) { /* ... */ }

@LogSubOperation('workflow_finalization')
private async finalize(data: any) { /* ... */ }
```

### 4. Context Extraction Guidelines

```typescript
// ✅ Extract key business identifiers
@LogOperation('payment_processing', PaymentLogger)
async processPayment(
  @LogContext('user') user: User,           // user_id extracted
  @LogContext('payment') payment: Payment,  // payment_id, amount extracted
  @LogContext('merchant') merchant: Merchant // merchant_id extracted
) {
  // Rich context automatically available for debugging and analytics
}

// ✅ Use custom context keys for clarity
@LogContext('source_wallet') sourceWallet: string,
@LogContext('destination_wallet') destWallet: string,

// ❌ Avoid over-extraction of large objects
@LogContext hugeDataStructure: ComplexObject  // May hit size limits
```

### 5. Error Handling

The decorators automatically handle errors, but you can enhance them:

```typescript
@LogOperation('risky_operation', GenericOperationLogger)
async riskyOperation(@LogContext data: Data) {
  try {
    return await this.performRiskyTask(data)
  } catch (error) {
    // Error is automatically logged with full context
    // Add custom business context if helpful
    if (error instanceof SpecificBusinessError) {
      // Error context will include data parameter automatically
      throw new EnhancedError('Business context: ' + data.businessId, error)
    }
    throw error
  }
}
```

## Log Structure

All structured logs follow this format:

```json
{
  "@timestamp": "2025-09-08T17:03:46.666Z",
  "message": "Operation completed successfully",
  "service": "eco-solver",
  "status": "info",
  "ddsource": "nodejs",
  "ddtags": "env:production,service:eco-solver,operation:quote_generation",

  "operation": {
    "id": "op_1757346436248_p9uoupx8d",
    "type": "quote_generation",
    "status": "completed",
    "level": 0,
    "method_name": "generateQuote"
  },

  "performance": {
    "duration_ms": 234.5,
    "memory_usage_mb": 45.2
  },

  "eco": {
    "quote_id": "quote_123456789",
    "d_app_id": "example-dapp",
    "source_chain_id": 1,
    "destination_chain_id": 137,
    "token_in_address": "0x...",
    "token_out_address": "0x...",
    "amount_in": "1000000000000000000",
    "execution_type": "GASLESS"
  },

  "error": {
    // Only present on failures
    "type": "ValidationError",
    "message": "Invalid token pair",
    "stack": "ValidationError: Invalid token pair\n    at ..."
  }
}
```

## Datadog Integration

### Automatic Optimizations

The system automatically handles:

- **Size limits**: Messages are capped at 1MB for Datadog ingestion
- **Field standardization**: Maps to Datadog standard fields (@timestamp, service, status, etc.)
- **High-cardinality handling**: Optimizes fields that might have many unique values
- **Tag formatting**: Proper Datadog tag syntax

### Dashboard Integration

Logs are structured for immediate use in Datadog dashboards:

- **Filter by operation type**: `operation.type:quote_generation`
- **Performance analysis**: Use `performance.duration_ms` for timing charts
- **Business metrics**: Analyze `eco.*` fields for business insights
- **Error tracking**: Filter by `operation.status:failed` and analyze `error.type`

### Custom Fields

Add your own fields to the `eco` section:

```typescript
// In your custom logger
protected extractBusinessContext(args: any[], result?: any) {
  return {
    // These appear as eco.custom_metric in logs
    custom_metric: this.calculateMetric(args),
    business_category: this.determineCategory(args),
    feature_enabled: this.checkFeatureFlag(args)
  }
}
```

## Migration from Legacy Logging

### Before (Manual Logging)

```typescript
async processQuote(request: QuoteRequest) {
  this.logger.log(`Starting quote generation for ${request.tokenIn} -> ${request.tokenOut}`)

  try {
    const result = await this.generateQuote(request)
    this.logger.log(`Quote generated: ${result.id}, amount: ${result.amountOut}`)
    return result
  } catch (error) {
    this.logger.error(`Quote generation failed: ${error.message}`)
    throw error
  }
}
```

### After (Structured Logging)

```typescript
@LogOperation('quote_generation', QuoteGenerationLogger)
async processQuote(@LogContext request: QuoteRequest): Promise<Quote> {
  // All logging handled automatically:
  // - Entry with request context
  // - Timing measurement
  // - Success with result context
  // - Error with full stack trace and context
  return await this.generateQuote(request)
}
```

## Troubleshooting

### Common Issues

1. **Decorator not logging**: Ensure the method is `async` or returns a Promise
2. **Missing context**: Check that `@LogContext` parameters are not undefined
3. **Size limit errors**: Large objects in context may be truncated - use custom extraction
4. **Performance impact**: Decorators add minimal overhead, but avoid in extremely high-frequency operations

### Debugging

Enable debug logging to see the structured log output:

```typescript
// In your environment
LOG_LEVEL = debug

// Logs will show the actual JSON structure being sent to Datadog
```

### Validation

The system includes schema validation in CI/CD. Logs that don't meet Datadog requirements will be flagged in GitHub Actions.

## Performance Considerations

- **Minimal overhead**: Decorators add <1ms per operation
- **Lazy evaluation**: Context extraction only happens if logging level permits
- **Size optimization**: Large objects are automatically truncated or summarized
- **Async logging**: Log writing doesn't block operation execution

## Support

For questions or issues with the logging system:

1. Review existing specialized loggers for patterns
2. Use the validation system to check log format compliance
3. Consider the Claude Code agent for logging system maintenance

---

This structured logging system provides rich observability while maintaining performance and developer productivity. Use the decorators for maximum benefit with minimal code changes.
