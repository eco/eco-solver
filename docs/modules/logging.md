# Logging Module

## Overview

The Logging module provides high-performance structured logging using Pino with OpenTelemetry integration for correlated observability. It replaces the previous Winston-based logging system with a faster, more feature-rich solution optimized for production workloads and blockchain applications.

## Why Pino?

The migration from Winston to Pino provides several key advantages:

- **Performance**: 10x faster than Winston with significantly lower overhead
- **Async Logging**: Native async logging reduces I/O blocking
- **OpenTelemetry Integration**: Built-in support for distributed tracing
- **BigInt Support**: Automatic serialization for blockchain data types
- **Modern Architecture**: Active development with modern Node.js optimizations
- **Production Ready**: Battle-tested in high-throughput environments

## Architecture

### Core Components

#### Logger
Custom logger class that extends `PinoLogger` from `nestjs-pino`.

**Location**: `src/modules/logging/logger.service.ts`

**Responsibilities:**
- Structured logging with automatic serialization
- OpenTelemetry trace context injection
- BigInt to string conversion
- Error object formatting
- Context management

**Key Features:**
- **Structured Format**: All logs use `{ msg: string, ...data }` format
- **Trace Correlation**: Automatically injects `trace_id`, `span_id`, `correlation_id` from active spans
- **BigInt Serialization**: Converts BigInt values to strings for JSON compatibility
- **Error Formatting**: Formats error objects with name, message, and stack
- **Multiple Log Levels**: trace, debug, info, warn, error, fatal

**Methods:**
- `trace(msg, data?)`: Trace-level logging
- `debug(msg, data?)`: Debug-level logging
- `info(msg, data?)`: Info-level logging
- `warn(msg, data?)`: Warning-level logging
- `error(msg, error, data?)`: Error-level logging with error object
- `fatal(msg, error, data?)`: Fatal-level logging with error object
- `setContext(context)`: Set logger context for filtering
- `log(msg, data?)`: Alias for `info()` (NestJS compatibility)
- `verbose(msg, data?)`: Alias for `debug()` (NestJS compatibility)

#### LoggerFactory
Factory service for creating Logger instances with consistent configuration.

**Location**: `src/modules/logging/logger-factory.service.ts`

**Responsibilities:**
- Create configured Logger instances
- Apply application-wide logger configuration
- Support dynamic context creation

**Methods:**
- `createLogger(context: string): Logger`: Create a new Logger with the specified context

**Usage:**
```typescript
constructor(private readonly loggerFactory: LoggerFactory) {}

const logger = this.loggerFactory.createLogger('DynamicContext');
logger.info('Message with dynamic context', { data: 'value' });
```

#### LoggingModule
Global NestJS module that configures the logging system.

**Location**: `src/modules/logging/logging.module.ts`

**Responsibilities:**
- Configure nestjs-pino LoggerModule
- Set up pino-pretty transport (development)
- Set up pino-opentelemetry-transport for OTLP log export (optional)
- Configure custom serializers
- Export Logger and LoggerFactory

## Configuration

### Environment Variables

```bash
# Pretty Logging (Development)
LOGGER_PRETTY=true  # Default: true in dev, false in production

# Log Level
LOGGER_PINO_CONFIG_PINO_HTTP_LEVEL=debug  # Options: trace, debug, info, warn, error, fatal

# Use Level Labels
LOGGER_PINO_CONFIG_PINO_HTTP_USE_LEVEL_LABELS=true  # Output "info" instead of 30

# Sensitive Data Masking
LOGGER_MASK_KEYWORDS_0=custom_secret
LOGGER_MASK_KEYWORDS_1=api_token

# OpenTelemetry Log Export (Optional)
LOGGER_OTEL_LOG_EXPORT_ENABLED=false
LOGGER_OTEL_LOG_EXPORT_ENDPOINT=http://localhost:4318/v1/logs
LOGGER_OTEL_LOG_EXPORT_HEADERS_X_CUSTOM=value
```

### Configuration Schema

**Location**: `src/config/schemas/logger.schema.ts`

```typescript
{
  usePino: boolean,
  pretty: boolean,
  pinoConfig: {
    pinoHttp: {
      level: string,
      useLevelLabels: boolean,
      redact: {
        paths: string[],
        remove: boolean
      }
    }
  },
  maskKeywords: string[],
  otelLogExport?: {
    enabled: boolean,
    endpoint?: string,
    headers: Record<string, string>
  }
}
```

## Usage Patterns

### Basic Logger Injection

```typescript
import { Logger } from '@/modules/logging/logger.service';

@Injectable()
export class MyService {
  constructor(private readonly logger: Logger) {
    this.logger.setContext(MyService.name);
  }

  async processIntent(intent: Intent) {
    this.logger.info('Processing intent', {
      intentHash: intent.intentHash,
      chainId: intent.sourceChainId
    });
  }
}
```

### Structured Logging

```typescript
// Info logging with metadata
this.logger.info('Intent validated', {
  intentHash: '0x...',
  chainId: 1n,  // Automatically serialized to string
  amount: 1000000n
});

// Error logging with error object
try {
  await this.processIntent(intent);
} catch (error) {
  this.logger.error('Intent processing failed', error, {
    intentHash: intent.intentHash,
    retry: 3
  });
}

// Warning logging
this.logger.warn('Low gas price detected', {
  gasPrice: gasPrice.toString(),
  threshold: threshold.toString()
});
```

### Factory Pattern for Dynamic Contexts

```typescript
import { LoggerFactory } from '@/modules/logging/logger-factory.service';

@Injectable()
export class DynamicService {
  constructor(private readonly loggerFactory: LoggerFactory) {}

  async handleChain(chainId: number) {
    const logger = this.loggerFactory.createLogger(`Chain-${chainId}`);
    logger.info('Handling chain', { chainId });
  }
}
```

### OpenTelemetry Trace Correlation

When OpenTelemetry spans are active, logs automatically include trace context:

```typescript
// Logs will include:
// - trace_id: OpenTelemetry trace ID
// - span_id: Current span ID
// - correlation_id: Correlation attribute from span
// - stage: Stage attribute from span

this.logger.info('Processing within traced operation', { data: 'value' });
// Output includes: { trace_id: "...", span_id: "...", correlation_id: "...", ...data }
```

## Features

### 1. Pretty Logging with pino-pretty

**Configuration**: `LOGGER_PRETTY` environment variable

**Features:**
- Colorized output for different log levels
- Formatted timestamps (`HH:MM:ss Z`)
- Hidden pid and hostname for cleaner output
- Multi-line formatting for readability

**When to Use:**
- **Development**: Enable for human-readable console output
- **Production**: Disable for structured JSON logs required by log aggregation tools

**Example Output:**
```
[14:32:15.123 +00:00] INFO (IntentService): Processing intent
    intentHash: "0x1234..."
    chainId: 1
```

### 2. Automatic BigInt Serialization

Blockchain applications frequently use BigInt for token amounts and chain IDs. The logger automatically converts BigInt to strings:

```typescript
this.logger.info('Token transfer', {
  amount: 1000000000000000000n,  // Automatically becomes "1000000000000000000"
  chainId: 1n                     // Automatically becomes "1"
});
```

### 3. Sensitive Data Masking

Two-layer approach to protect sensitive information:

**Path-based Redaction** (Pino configuration):
- Authorization headers
- Cookies
- Stack traces (in production)

**Keyword Masking** (Custom helper):
- Scans log data recursively
- Masks fields containing keywords (case-insensitive)
- Default keywords: password, secret, token, key, privateKey, api_key, authorization, auth

**Configuration:**
```bash
# Add custom keywords
LOGGER_MASK_KEYWORDS_0=wallet_seed
LOGGER_MASK_KEYWORDS_1=mnemonic
```

**Example:**
```typescript
this.logger.info('User login', {
  username: 'alice',
  password: 'secret123',  // Will be masked as "***"
  api_key: 'key-123'      // Will be masked as "***"
});
```

### 4. OpenTelemetry Integration

#### Automatic Trace Context

When OpenTelemetry spans are active, logs automatically include:
- `trace_id`: Distributed trace identifier
- `span_id`: Current span identifier
- `correlation_id`: Correlation attribute from span
- `stage`: Stage attribute from span

#### OTLP Log Export

Optionally export logs to OpenTelemetry collector for unified observability:

```bash
LOGGER_OTEL_LOG_EXPORT_ENABLED=true
LOGGER_OTEL_LOG_EXPORT_ENDPOINT=http://localhost:4318/v1/logs
```

**Features:**
- Batch log record processing
- Automatic severity level mapping
- Custom headers support
- Falls back to OpenTelemetry OTLP endpoint if not specified

## Best Practices

### 1. Always Set Context

```typescript
constructor(private readonly logger: Logger) {
  this.logger.setContext(MyService.name);
}
```

This helps filter and identify log sources in production.

### 2. Use Structured Logging

```typescript
// Good
this.logger.info('Intent processed', { intentHash, chainId, duration });

// Bad - loses structure
this.logger.info(`Intent ${intentHash} processed on chain ${chainId}`);
```

### 3. Include Relevant Metadata

```typescript
this.logger.info('Transaction sent', {
  txHash,
  chainId,
  to,
  value: value.toString(),
  gasPrice: gasPrice.toString()
});
```

### 4. Log Errors with Context

```typescript
try {
  await operation();
} catch (error) {
  this.logger.error('Operation failed', error, {
    operationId,
    attempt,
    willRetry
  });
}
```

### 5. Use Appropriate Log Levels

- **trace**: Very detailed debugging information
- **debug**: Debug information for development
- **info**: General information about application flow
- **warn**: Warning messages that don't require immediate action
- **error**: Error events that might still allow the application to continue
- **fatal**: Critical errors that cause the application to terminate

## Migration from Winston

### Changes Required

**Before (Winston):**
```typescript
import { LoggerService } from '@/modules/logging/logger.service';  // or SystemLoggerService

constructor(private readonly logger: LoggerService) {
  this.logger.setContext(MyService.name);
}

this.logger.log('Processing intent', { intentHash });  // Metadata as second parameter
```

**After (Pino):**
```typescript
import { Logger } from '@/modules/logging/logger.service';

constructor(private readonly logger: Logger) {
  this.logger.setContext(MyService.name);
}

this.logger.info('Processing intent', { intentHash });  // Structured data
```

### Key Differences

1. **No More LoggerService/SystemLoggerService**: Use single `Logger` class
2. **Structured Format**: Data is now part of structured object, not metadata
3. **Method Names**: Use `info()`, `debug()`, etc. instead of `log()` with level
4. **Error Logging**: Pass error as second parameter: `error(msg, error, data)`
5. **BigInt Support**: No need for manual `.toString()` conversion

### Benefits

- **10x Performance Improvement**: Faster logging with lower overhead
- **Better Observability**: Automatic OpenTelemetry correlation
- **Simpler API**: Single Logger class instead of two services
- **Type Safety**: Better TypeScript support
- **Modern Features**: Active development and ecosystem

## Troubleshooting

### Logs Not Appearing

**Check log level**:
```bash
LOGGER_PINO_CONFIG_PINO_HTTP_LEVEL=debug
```

**Check pino-pretty configuration**:
```bash
LOGGER_PRETTY=true  # Should be true in development
```

### BigInt Serialization Errors

The logger handles this automatically. If you see errors:
- Ensure you're using the Logger from `@/modules/logging/logger.service`
- Don't use `JSON.stringify()` directly on log data

### Trace Context Not Appearing

Ensure OpenTelemetry is enabled and spans are active:
```bash
OPENTELEMETRY_ENABLED=true
```

Logs will only include trace context when within an active span.

### OTLP Log Export Not Working

1. **Check if enabled**:
   ```bash
   LOGGER_OTEL_LOG_EXPORT_ENABLED=true
   ```

2. **Verify endpoint**:
   ```bash
   LOGGER_OTEL_LOG_EXPORT_ENDPOINT=http://localhost:4318/v1/logs
   ```

3. **Check collector logs** for connection errors

4. **Verify headers** if using authentication

## Performance Considerations

### Async Logging

Pino uses async logging by default, which means:
- Log operations don't block the event loop
- Better performance under high load
- Logs may be buffered briefly before output

### Production Optimization

**Disable pino-pretty in production**:
```bash
LOGGER_PRETTY=false  # or omit, defaults to false in production
```

**Set appropriate log level**:
```bash
LOGGER_PINO_CONFIG_PINO_HTTP_LEVEL=info  # Avoid debug/trace in production
```

**Use log aggregation**:
- Send JSON logs to ELK, Splunk, DataDog, or CloudWatch
- Pino's JSON format is optimized for machine parsing

## References

- [Pino Documentation](https://getpino.io/)
- [nestjs-pino](https://github.com/iamolegga/nestjs-pino)
- [pino-pretty](https://github.com/pinojs/pino-pretty)
- [OpenTelemetry Logs Bridge](https://opentelemetry.io/docs/reference/specification/logs/bridge-api/)
