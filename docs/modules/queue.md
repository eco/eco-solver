# Queue Module

## Overview

The Queue module manages asynchronous job processing using BullMQ and Redis. It provides a reliable, scalable infrastructure for processing intents through two main queues: fulfillment and execution.

## Architecture

### Core Components

#### QueueService
Centralized service for all queue operations.

**Responsibilities:**
- Manage queue lifecycle
- Provide standardized job interfaces
- Handle job creation and monitoring
- Ensure consistent job structure

**Key Methods:**
- `addIntentToFulfillmentQueue(intent: Intent, strategy: string)`: Queue for validation
- `addIntentToExecutionQueue(intent: Intent, strategy: string)`: Queue for execution
- `getQueueMetrics(queueName: string)`: Get queue statistics
- `pauseQueue(queueName: string)`: Pause processing
- `resumeQueue(queueName: string)`: Resume processing

#### Queue Types

1. **Fulfillment Queue** (`intent-fulfillment`)
   - Processes intent validation
   - Runs strategy-specific validations
   - Determines execution eligibility

2. **Execution Queue** (`blockchain-execution`)
   - Processes validated intents
   - Executes blockchain transactions
   - Handles transaction confirmation

### Job Structure

#### Fulfillment Job
```typescript
interface FulfillmentJob {
  id: string;
  data: {
    intent: Intent;
    strategy: string;
    metadata?: {
      source: string;
      timestamp: number;
      correlationId?: string;
    };
  };
}
```

#### Execution Job
```typescript
interface ExecutionJob {
  id: string;
  data: {
    intent: Intent;
    strategy: string;
    walletType?: string;
    metadata?: {
      validatedAt: number;
      attempts?: number;
      correlationId?: string;
    };
  };
}
```

## Queue Configuration

### BullMQ Settings
```typescript
interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    maxRetriesPerRequest?: number;
  };
  queues: {
    fulfillment: {
      name: string;
      concurrency: number;
      defaultJobOptions: {
        attempts: number;
        backoff: {
          type: 'exponential' | 'fixed';
          delay: number;
        };
        removeOnComplete: boolean | number;
        removeOnFail: boolean | number;
      };
    };
    execution: {
      name: string;
      concurrency: number;
      defaultJobOptions: {
        attempts: number;
        backoff: {
          type: 'exponential' | 'fixed';
          delay: number;
        };
        removeOnComplete: boolean | number;
        removeOnFail: boolean | number;
      };
    };
  };
  worker: {
    maxStalledCount: number;
    stalledInterval: number;
    lockDuration: number;
  };
}
```

### Default Configuration
```yaml
redis:
  host: localhost
  port: 6379
  maxRetriesPerRequest: 3

queues:
  fulfillment:
    name: intent-fulfillment
    concurrency: 10
    defaultJobOptions:
      attempts: 3
      backoff:
        type: exponential
        delay: 2000
      removeOnComplete: 100
      removeOnFail: 500
  
  execution:
    name: blockchain-execution
    concurrency: 5
    defaultJobOptions:
      attempts: 3
      backoff:
        type: exponential
        delay: 5000
      removeOnComplete: 100
      removeOnFail: 1000

worker:
  maxStalledCount: 3
  stalledInterval: 30000
  lockDuration: 30000
```

### Execution Queue Configuration

The execution queue now supports configurable retry and backoff settings:

| Environment Variable | Description | Default | Range |
|---------------------|-------------|---------|-------|
| `QUEUE_EXECUTION_ATTEMPTS` | Number of retry attempts | 3 | 1+ |
| `QUEUE_EXECUTION_BACKOFF_DELAY` | Base delay for exponential backoff (ms) | 2000 | 100+ |
| `QUEUE_EXECUTION_BACKOFF_MAX_DELAY` | Maximum backoff delay cap (ms) | 300000 (5 min) | 1000+ |
| `QUEUE_EXECUTION_BACKOFF_JITTER` | Jitter factor to prevent thundering herd | 0.5 | 0-1 |
| `QUEUE_EXECUTION_USE_CUSTOM_BACKOFF` | Enable exponentialCapped backoff strategy | true | true/false |

#### ExponentialCapped Backoff Strategy

The execution queue uses a custom backoff strategy that implements exponential backoff with a configurable cap and jitter:

**Delay Calculation:**
```
delay = min(baseDelay * 2^(attempt-1), maxDelay) * (1 - random() * jitter)
```

**Features:**
- **Exponential Growth**: Each retry doubles the delay (2000ms → 4000ms → 8000ms...)
- **Maximum Cap**: Delays never exceed 5 minutes (300000ms) to prevent excessive waits
- **Jitter**: Adds randomness (0-50% reduction by default) to prevent thundering herd issues when multiple jobs fail simultaneously

**Example Delays** (with default configuration):
- Attempt 1: 1000-2000ms (2000ms * 2^0 with 0.5 jitter)
- Attempt 2: 2000-4000ms (2000ms * 2^1 with 0.5 jitter)
- Attempt 3: 4000-8000ms (2000ms * 2^2 with 0.5 jitter)

If delays reach the cap (5 minutes), subsequent retries will use delays between 2.5-5 minutes due to jitter.

## Queue Processors

### FulfillmentProcessor
Processes jobs from the fulfillment queue.

**Flow:**
1. Retrieve job from queue
2. Load strategy based on job data
3. Execute validation pipeline
4. Queue valid intents for execution
5. Update intent status in database

**Error Handling:**
- Validation failures mark intent as invalid
- Transient errors trigger retry
- Permanent errors move to dead letter queue

### BlockchainProcessor
Processes jobs from the execution queue.

**Flow:**
1. Retrieve job from queue
2. Load intent and strategy
3. Execute on target blockchain
4. Await transaction confirmation
5. Update intent status

**Error Handling:**
- Insufficient balance triggers retry with backoff
- Network errors trigger immediate retry
- Invalid transactions marked as failed

## Job Lifecycle

### States
1. **Waiting**: Job in queue awaiting processing
2. **Active**: Currently being processed
3. **Completed**: Successfully processed
4. **Failed**: Processing failed after all retries
5. **Delayed**: Scheduled for future processing
6. **Stalled**: Worker crashed during processing

### State Transitions
```
Waiting → Active → Completed
   ↓        ↓         ↑
Delayed ← Failed ← Stalled
```

## Retry Mechanism

### Exponential Backoff
```typescript
const backoffDelay = baseDelay * Math.pow(2, attemptNumber);
```

### Retry Configuration
- **Fulfillment Queue**: 3 attempts, 2s base delay
- **Execution Queue**: 3 attempts, 5s base delay
- **Custom Retry**: Can be set per job

### Dead Letter Queue
Failed jobs after max retries are moved to dead letter queue for manual inspection.

## Queue Monitoring

### Metrics
- **Queue Depth**: Number of waiting jobs
- **Processing Rate**: Jobs processed per minute
- **Success Rate**: Percentage of successful jobs
- **Average Duration**: Mean processing time
- **Failed Jobs**: Count and reasons

### Health Checks
```typescript
interface QueueHealth {
  isHealthy: boolean;
  metrics: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  redisStatus: 'connected' | 'disconnected';
  lastProcessedAt: Date;
}
```

## OpenTelemetry Integration

### Queue Tracing
The module integrates with OpenTelemetry for distributed tracing:

```typescript
@Injectable()
export class QueueTracingService {
  // Automatically creates spans for queue jobs
  // Propagates trace context through job data
  // Links producer and consumer spans
}
```

### Trace Context Propagation
1. Producer injects trace context into job data
2. Consumer extracts context from job
3. Child span created for job processing
4. Context flows through entire execution

## Usage Examples

### Adding Jobs to Queue
```typescript
// Add to fulfillment queue
await queueService.addIntentToFulfillmentQueue(
  intent,
  'standard' // strategy name
);

// Add to execution queue
await queueService.addIntentToExecutionQueue(
  intent,
  'standard', // strategy name
  { walletType: 'kernel' } // optional metadata
);
```

### Monitoring Queue
```typescript
// Get queue metrics
const metrics = await queueService.getQueueMetrics('intent-fulfillment');
console.log(`Waiting: ${metrics.waiting}`);
console.log(`Active: ${metrics.active}`);
console.log(`Completed: ${metrics.completed}`);

// Check queue health
const health = await queueService.getQueueHealth();
if (!health.isHealthy) {
  console.error('Queue unhealthy:', health);
}
```

### Queue Control
```typescript
// Pause processing
await queueService.pauseQueue('blockchain-execution');

// Resume processing
await queueService.resumeQueue('blockchain-execution');

// Clear failed jobs
await queueService.clearFailedJobs('intent-fulfillment');

// Retry failed jobs
await queueService.retryFailedJobs('blockchain-execution');
```

## Best Practices

### Job Design
- Keep job data minimal
- Store large data in database
- Include correlation IDs
- Add metadata for debugging

### Error Handling
- Distinguish transient vs permanent errors
- Implement proper retry logic
- Log errors with context
- Monitor failed job patterns

### Performance
- Tune concurrency based on workload
- Use appropriate job priorities
- Implement rate limiting if needed
- Monitor Redis memory usage

### Reliability
- Configure proper Redis persistence
- Implement graceful shutdown
- Handle worker crashes
- Monitor stalled jobs

## Scaling Strategies

### Horizontal Scaling
- Run multiple worker instances
- Redis coordinates job distribution
- No duplicate processing
- Load balanced automatically

### Vertical Scaling
- Increase worker concurrency
- Adjust Redis connection pool
- Optimize job processing logic
- Profile and remove bottlenecks

### Queue Prioritization
```typescript
// High priority job
await queue.add('process', data, {
  priority: 1, // Lower number = higher priority
});

// Normal priority
await queue.add('process', data, {
  priority: 10,
});
```

## Troubleshooting

### Common Issues

1. **Jobs Stuck in Queue**
   - Check worker health
   - Verify Redis connection
   - Review concurrency settings
   - Look for stalled jobs

2. **High Failure Rate**
   - Review error logs
   - Check retry configuration
   - Verify external dependencies
   - Monitor error patterns

3. **Memory Issues**
   - Check Redis memory usage
   - Review job retention policy
   - Clear old completed jobs
   - Optimize job data size

4. **Performance Problems**
   - Profile job processing
   - Check Redis latency
   - Review concurrency settings
   - Optimize processing logic

### Debugging Tools

#### BullMQ Dashboard
Monitor queues visually:
```bash
npm install -g bull-board
bull-board -r redis://localhost:6379
```

#### Redis CLI
Direct queue inspection:
```bash
redis-cli
> KEYS bull:*
> LLEN bull:intent-fulfillment:wait
> HGETALL bull:intent-fulfillment:job:1
```

#### Logging
Enable debug logging:
```typescript
// Set log level to debug
process.env.LOG_LEVEL = 'debug';
```

## Security Considerations

### Redis Security
- Use password authentication
- Enable TLS for connections
- Restrict network access
- Regular security updates

### Job Data Security
- Don't store sensitive data in jobs
- Use encryption for sensitive fields
- Implement access controls
- Audit job processing

### Rate Limiting
- Implement per-client limits
- Prevent queue flooding
- Monitor suspicious patterns
- Use circuit breakers