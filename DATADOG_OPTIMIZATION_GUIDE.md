# Datadog Optimization Guide

## Overview

The specialized logging system includes advanced Datadog optimizations designed to improve log processing performance, reduce costs, and ensure compliance with Datadog's technical limits.

## Key Features

### 1. Automatic Validation and Compliance

- **Size Limits**: Automatically validates and truncates logs exceeding 25KB
- **Attribute Limits**: Ensures logs don't exceed 256 attributes
- **Nesting Limits**: Prevents excessive nesting beyond 20 levels
- **Key Length**: Truncates attribute keys exceeding 50 characters
- **Value Length**: Truncates attribute values exceeding 1024 characters for faceted fields

### 2. High-Cardinality Field Optimization

High-cardinality identifiers (like intent hashes, quote IDs) are automatically optimized for faceted search:

```typescript
// Input
{ eco: { intent_hash: "0x1234567890abcdef..." } }

// Optimized Output
{
  eco: {
    intent_hash: "0x1234567890ab...a1b2c3", // Shortened for facets
    intent_hash_full: "0x1234567890abcdef..." // Full value preserved
  }
}
```

### 3. Performance Monitoring

Built-in metrics tracking:

- Validation time per log entry
- Log size distribution
- Truncation rates
- Warning frequencies

Access metrics via: `GET /health/logging/metrics`

### 4. Progressive Truncation Strategy

When logs exceed size limits, the system applies progressive truncation:

1. **String Truncation**: Long string values are truncated first
2. **Property Removal**: Optional properties (`properties`, `error`) are removed
3. **Size Markers**: Truncation is clearly marked in the log structure

## Configuration

### Default Production Configuration

```typescript
import { DEFAULT_LOGGING_CONFIG } from '@/common/logging/logging.config'

const logger = new LiquidityManagerLogger('ServiceName', {
  enableDatadogOptimization: true, // Uses DEFAULT_LOGGING_CONFIG
})
```

### High-Performance Configuration

For high-volume services where performance is critical:

```typescript
import { HIGH_PERFORMANCE_LOGGING_CONFIG } from '@/common/logging/logging.config'

const logger = new LiquidityManagerLogger('ServiceName', {
  enableDatadogOptimization: false, // Disables validation overhead
})
```

### Development Configuration

Enhanced debugging for development:

```typescript
import { DEVELOPMENT_LOGGING_CONFIG } from '@/common/logging/logging.config'

const logger = new LiquidityManagerLogger('ServiceName', {
  enableDatadogOptimization: true,
  logValidationWarnings: true,
})
```

## Monitoring and Alerting

### Health Metrics

The system exposes comprehensive health metrics:

- **Average Validation Time**: Time spent on log validation
- **Truncation Rate**: Percentage of logs requiring truncation
- **Warning Rate**: Percentage of logs generating warnings
- **System Health Status**: `healthy`, `warning`, or `critical`

### Recommendations

The system provides automated recommendations based on metrics:

- High validation time → Reduce payload size
- Large log payloads → Review property inclusion
- High truncation rate → Simplify log structure
- Frequent warnings → Adjust to Datadog limits

### Alerting Thresholds

**Warning Level**:

- Average validation time > 5ms
- Truncation rate > 5%

**Critical Level**:

- Average validation time > 10ms
- Truncation rate > 10%

## Best Practices

### 1. Property Selection

Only include essential properties in log context:

```typescript
// Good - Essential context only
logger.log({
  rebalanceId: 'rb-123',
  walletAddress: '0x...',
  strategy: 'Gateway'
}, 'Rebalancing started')

// Avoid - Excessive properties
logger.log({
  rebalanceId: 'rb-123',
  walletAddress: '0x...',
  strategy: 'Gateway',
  fullConfig: {...}, // Large object
  debugInfo: {...}, // Development-only data
  timestamps: [...] // Redundant data
}, 'Rebalancing started')
```

### 2. High-Cardinality Fields

Let the system optimize high-cardinality fields automatically:

```typescript
// System automatically creates faceted versions
logger.log(
  {
    intentHash: longIntentHash, // Auto-optimized for facets
    quoteId: longQuoteId, // Auto-optimized for facets
  },
  'Intent processed',
)
```

### 3. Error Context

Include structured error context without excessive detail:

```typescript
// Good - Structured error info
logger.error(
  {
    operationType: 'rebalancing',
    status: 'failed',
  },
  'Rebalancing failed',
  {
    error: { message: error.message, code: error.code },
    context: { walletAddress, strategy },
  },
)

// Avoid - Full error objects
logger.error({}, 'Rebalancing failed', {
  fullError: error, // May contain stack traces, circular refs
  allData: entireState, // Excessive context
})
```

## Performance Impact

### Validation Overhead

- **Typical**: 1-2ms per log entry
- **Complex logs**: 3-5ms per log entry
- **Very large logs**: 5-10ms per log entry

### Memory Usage

- **Validation**: Temporary memory during processing
- **Optimization**: Minimal memory overhead
- **Metrics**: ~1KB per 1000 log entries

### When to Disable

Consider disabling Datadog optimization for:

- Extremely high-volume endpoints (>1000 logs/second)
- Latency-critical paths
- Services with simple, compliant log structures

## Troubleshooting

### High Validation Times

1. Check log payload sizes
2. Review nested object complexity
3. Consider simplifying log structure
4. Use high-performance configuration

### Frequent Truncations

1. Review `properties` object size
2. Limit nested object depth
3. Remove development-only data
4. Use summary fields for large datasets

### Memory Issues

1. Monitor metrics endpoint for trends
2. Check for circular references in logged objects
3. Review error context inclusion
4. Consider log sampling for high-volume services

## Migration Guide

### From EcoLogMessage

```typescript
// Before
logger.debug(
  EcoLogMessage.fromDefault({
    message: 'Operation completed',
    properties: { id, status },
  }),
)

// After
logger.debug(
  {
    operationType: 'operation_name',
    status: 'completed',
  },
  'Operation completed',
  { id },
)
```

### From Standard Logger

```typescript
// Before
logger.log('User action', { userId, action })

// After
logger.log(
  {
    operationType: 'user_action',
    status: 'completed',
  },
  'User action completed',
  { userId, action },
)
```

## Datadog Query Optimization

### Faceted Search

Use optimized fields for faceted search:

```
@eco.intent_hash:0x1234* // Fast faceted search
@eco.intent_hash_full:"0x1234567890abcdef..." // Exact match
```

### Performance Queries

```
@operation.type:rebalancing @operation.status:failed
@eco.strategy:Gateway @metrics.amount_in:>1000
```

### Metrics and Analytics

```
@performance.response_time_ms:>5000
@operation.duration_ms:[100 TO 1000]
```
