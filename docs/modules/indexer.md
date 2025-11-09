# Indexer Module

## Overview

The Indexer module provides integration with the Ponder.sh GraphQL indexer service to query historical blockchain events from multiple EVM chains. This module is optional and complements the real-time event listeners by providing reliable access to historical event data through a queryable GraphQL interface.

## Architecture

### Core Components

#### IndexerService
Main service that wraps the GraphQL client and provides type-safe query methods.

**Responsibilities:**
- Execute GraphQL queries against the indexer
- Handle cursor-based pagination automatically
- Convert BigInt values for GraphQL compatibility
- Log query operations and errors

**Key Methods:**
- `queryPublishedIntents(variables)`: Fetch IntentPublished events
- `queryFulfilledIntents(variables)`: Fetch IntentFulfilled events
- `queryWithdrawnIntents(variables)`: Fetch IntentWithdrawn events
- `queryFundedIntents(variables)`: Fetch refund events

**Return Type:** All methods return `AsyncGenerator` for streaming pagination

#### IndexerConfigService
Provides type-safe access to indexer configuration.

**Responsibilities:**
- Load indexer configuration from environment
- Provide default polling intervals
- Validate configuration availability

**Key Methods:**
- `config`: Get full indexer configuration
- `url`: Get indexer GraphQL endpoint URL
- `intervals`: Get polling intervals for each event type
- `isConfigured()`: Check if indexer is enabled

## Configuration

### Environment Variables

```bash
# Required: Indexer GraphQL endpoint
EVM_INDEXER_URL=https://indexer.eco.com/

# Optional: Polling intervals (milliseconds) - these are the defaults
EVM_INDEXER_INTERVALS_INTENT_PUBLISHED=2000   # 2 seconds
EVM_INDEXER_INTERVALS_INTENT_FUNDED=5000      # 5 seconds
EVM_INDEXER_INTERVALS_INTENT_FULFILLED=5000   # 5 seconds
EVM_INDEXER_INTERVALS_INTENT_WITHDRAWN=60000  # 60 seconds (1 minute)
```

### Configuration Schema

```typescript
interface IndexerConfig {
  url: string;                    // GraphQL endpoint URL
  intervals: {
    intentPublished: number;      // Polling interval in milliseconds
    intentFunded: number;
    intentFulfilled: number;
    intentWithdrawn: number;
  };
}
```

### Optional Loading

The IndexerModule is **optional** and only loads when configured:

```typescript
// In EvmModule.forRootAsync()
if (config.evm?.indexer) {
  imports.push(IndexerModule);
}
```

**Benefits:**
- Backward compatible (no breaking changes)
- Module not loaded if indexer URL not configured
- No performance impact when disabled

## GraphQL Queries

### Query Structure

All queries follow a consistent pattern:

**Parameters:**
- `portalAddresses`: Array of portal contract addresses (filters by contract)
- `since`: BigInt timestamp (filters events after this time)
- `after`: Optional cursor for pagination

**Response:**
```typescript
{
  items: T[];              // Array of event objects
  totalCount: number;      // Total count across all pages
  pageInfo: {
    hasNextPage: boolean;  // More pages available
    endCursor: string;     // Cursor for next page
  }
}
```

**Pagination:**
- Max 50 items per page
- Cursor-based pagination
- Automatic iteration via async generators

### Available Queries

#### PublishedIntents
Queries `intents` collection for IntentPublished events.

**Fields:**
- `hash`: Intent hash
- `chainId`: Source chain ID
- `params`: Event parameters (JSON object)
- `transactionHash`: Transaction hash
- `blockNumber`, `blockTimestamp`: Block info (BigInt)
- `evt_log_address`: Portal contract address
- `evt_log_index`: Event log index
- `from`: Event sender address

**Usage:**
```typescript
for await (const batch of indexerService.queryPublishedIntents({
  portalAddresses: ['0x...'],
  since: BigInt(timestamp),
})) {
  for (const intent of batch) {
    console.log(`Intent: ${intent.hash} on chain ${intent.chainId}`);
  }
}
```

#### FulfilledIntents
Queries `fulfillments` collection for IntentFulfilled events.

**Fields:**
- `hash`: Intent hash
- `chainId`: Chain ID where fulfilled
- `transactionHash`: Fulfillment transaction
- `blockNumber`, `blockTimestamp`: Block info (BigInt)
- `evt_log_address`: Portal contract address
- `evt_log_index`: Event log index

#### WithdrawnIntents
Queries `withdrawals` collection for IntentWithdrawn events.

**Fields:** Same as FulfilledIntents

#### FundedIntents
Queries `refunds` collection for funding-related events.

**Fields:** Same as FulfilledIntents

**Note:** The indexer schema uses "refunds" instead of "funded" events.

## Usage Examples

### Basic Query

```typescript
import { IndexerService } from './indexer/indexer.service';

@Injectable()
export class MyService {
  constructor(private readonly indexerService: IndexerService) {}

  async getRecentIntents() {
    const oneDayAgo = BigInt(Math.floor(Date.now() / 1000) - 86400);

    const allIntents = [];
    for await (const batch of this.indexerService.queryPublishedIntents({
      portalAddresses: ['0xPortalAddress1', '0xPortalAddress2'],
      since: oneDayAgo,
    })) {
      allIntents.push(...batch);
    }

    return allIntents;
  }
}
```

### Pagination with Limits

```typescript
async getLimitedIntents(maxIntents: number) {
  const since = BigInt(0);
  const results = [];

  for await (const batch of this.indexerService.queryPublishedIntents({
    portalAddresses: ['0x...'],
    since,
  })) {
    results.push(...batch);

    if (results.length >= maxIntents) {
      break; // Stop after reaching limit
    }
  }

  return results.slice(0, maxIntents);
}
```

### Multi-Chain Query

```typescript
async getIntentsFromAllChains() {
  // Get portal addresses from all configured networks
  const portalAddresses = this.evmConfigService.networks.map(
    (network) => network.contracts.portal
  );

  const intentsByChain = new Map<number, any[]>();

  for await (const batch of this.indexerService.queryPublishedIntents({
    portalAddresses,
    since: BigInt(0),
  })) {
    for (const intent of batch) {
      if (!intentsByChain.has(intent.chainId)) {
        intentsByChain.set(intent.chainId, []);
      }
      intentsByChain.get(intent.chainId)!.push(intent);
    }
  }

  return intentsByChain;
}
```

## Type Definitions

### IndexedIntent

```typescript
interface IndexedIntent {
  hash: string;                    // Intent hash
  chainId: number;                 // Source chain ID
  params: any;                     // Event parameters (to be parsed with Portal ABI)
  transactionHash: string;         // Transaction hash
  blockNumber: bigint;             // Block number
  blockTimestamp: bigint;          // Block timestamp (Unix seconds)
  evt_log_address: string;         // Portal contract address
  evt_log_index: number;           // Log index in transaction
  from: string;                    // Sender address
}
```

### IndexedFulfillment / IndexedWithdrawal / IndexedRefund

```typescript
interface IndexedFulfillment {
  hash: string;
  chainId: number;
  transactionHash: string;
  blockNumber: bigint;
  blockTimestamp: bigint;
  evt_log_address: string;
  evt_log_index: number;
}
```

### PageInfo

```typescript
interface PageInfo {
  hasNextPage: boolean;            // True if more pages available
  endCursor: string | null;        // Cursor for next page
}
```

### PaginatedResponse

```typescript
interface PaginatedResponse<T> {
  items: T[];                      // Current page items
  totalCount: number;              // Total across all pages
  pageInfo: PageInfo;              // Pagination info
}
```

## Integration with EVM Module

### Module Loading

The IndexerModule is conditionally imported in `EvmModule.forRootAsync()`:

```typescript
@Module({})
export class EvmModule {
  static async forRootAsync(): Promise<DynamicModule> {
    const config = await configurationFactory();

    const imports = [
      ConfigModule,
      LoggingModule,
      // ... other modules
    ];

    // Conditionally import IndexerModule only if configured
    if (config.evm?.indexer) {
      imports.push(IndexerModule);
    }

    return {
      module: EvmModule,
      imports,
      providers: [/* ... */],
      exports: [/* ... */],
    };
  }
}
```

### Dependency Injection

Services can optionally inject IndexerService:

```typescript
import { Optional } from '@nestjs/common';
import { IndexerService } from './indexer/indexer.service';

@Injectable()
export class MyService {
  constructor(
    @Optional() private readonly indexerService?: IndexerService,
  ) {}

  async doSomething() {
    if (!this.indexerService) {
      this.logger.warn('Indexer not configured, skipping');
      return;
    }

    // Use indexer service
    for await (const batch of this.indexerService.queryPublishedIntents({...})) {
      // Process batch
    }
  }
}
```

## Testing

### Unit Tests

Location: `src/modules/blockchain/evm/indexer/tests/`

**IndexerService Tests** (12 tests):
- Pagination logic (single page, multiple pages, empty results)
- BigInt to string conversion
- Error handling
- Debug logging

**IndexerConfigService Tests** (11 tests):
- Configuration loading
- URL retrieval
- Interval defaults
- isConfigured() checks

**Coverage:**
- Overall: 85.86%
- IndexerConfigService: 100%
- IndexerService: 90.62%
- All queries: 100%

**Run Tests:**
```bash
# Run all indexer tests
pnpm test -- indexer

# Run with coverage
pnpm test:cov -- indexer

# Run specific test file
pnpm test -- indexer.service.spec.ts
```

### Integration Tests

Location: `src/modules/blockchain/evm/indexer/tests/indexer.integration.spec.ts`

**Tests Against Real Indexer:**
- Fetch published intents from actual indexer
- Verify pagination behavior
- Test all query types
- Validate response structure
- Error handling with invalid addresses

**Run Integration Tests:**
```bash
# Set indexer URL and run
EVM_INDEXER_URL=https://indexer.eco.com/ pnpm test -- indexer.integration.spec.ts

# Tests are skipped if EVM_INDEXER_URL is not set
```

## Performance Considerations

### Pagination Strategy

The async generator pattern provides memory-efficient streaming:

```typescript
// Good: Streams results, low memory usage
for await (const batch of service.queryPublishedIntents({...})) {
  await processBatch(batch); // Process incrementally
}

// Avoid: Loads all results into memory
const allIntents = [];
for await (const batch of service.queryPublishedIntents({...})) {
  allIntents.push(...batch);
}
```

### Rate Limiting

The indexer may have rate limits. For polling implementations:
- Use configurable intervals (default: 2s-60s)
- Avoid aggressive polling
- Implement exponential backoff on errors

### BigInt Conversion

GraphQL requires BigInt values as strings:
- `since` parameter: Automatically converted to string
- Response values: Parsed as BigInt in TypeScript

## Error Handling

### GraphQL Errors

All query methods handle GraphQL errors consistently:

```typescript
try {
  const response = await this.client.request(...);
  // Process response
} catch (error) {
  this.logger.error(`Failed to fetch intents`, toError(error));
  throw error; // Re-throw for caller to handle
}
```

**Error Types:**
- Network errors (timeout, connection refused)
- GraphQL schema errors (invalid query)
- Invalid parameters (malformed addresses)
- Rate limiting (429 errors)

### Handling Missing Configuration

```typescript
// Service throws if URL requested when not configured
try {
  const url = configService.url;
} catch (error) {
  // Error: 'Indexer configuration is not defined'
}

// Safe check using isConfigured()
if (configService.isConfigured()) {
  const url = configService.url; // Safe
}
```

## Best Practices

### 1. Check Configuration Before Use

```typescript
if (!this.indexerConfigService.isConfigured()) {
  this.logger.warn('Indexer not configured');
  return;
}
```

### 2. Use Async Generators for Pagination

```typescript
// Don't collect all results upfront
for await (const batch of service.queryPublishedIntents({...})) {
  await processBatch(batch); // Process incrementally
}
```

### 3. Filter by Timestamp

```typescript
// Only query events since last check
const lastTimestamp = getLastProcessedTimestamp();
const since = BigInt(lastTimestamp);

for await (const batch of service.queryPublishedIntents({
  portalAddresses,
  since,
})) {
  // Process new events only
}
```

### 4. Handle Multi-Chain Results

```typescript
// Portal addresses may differ across chains
const portalAddresses = networks.map(n => n.contracts.portal);

for await (const batch of service.queryPublishedIntents({
  portalAddresses,
  since: BigInt(0),
})) {
  for (const intent of batch) {
    // Filter by chain if needed
    if (intent.chainId === targetChainId) {
      processIntent(intent);
    }
  }
}
```

## Troubleshooting

### Module Not Loading

**Issue:** IndexerService not available for injection

**Solution:**
1. Verify `EVM_INDEXER_URL` is set in environment
2. Check configuration with: `configService.get('evm.indexer')`
3. Ensure EvmModule.forRootAsync() is called in BlockchainModule
4. Use `@Optional()` decorator when injecting IndexerService

### GraphQL Errors

**Issue:** Queries fail with GraphQL schema errors

**Solution:**
1. Verify indexer URL is accessible: `curl https://indexer.eco.com/`
2. Check portal addresses are valid EVM addresses
3. Ensure `since` timestamp is not in the future
4. Verify query syntax matches schema

### BigInt Serialization Errors

**Issue:** BigInt values cause serialization errors

**Solution:**
- `since` parameter: Automatically converted to string
- Response parsing: GraphQL returns strings, converted to BigInt by type system
- Use `.toString()` for any manual BigInt conversions

### No Results Returned

**Issue:** Queries return empty results

**Possible Causes:**
1. `since` timestamp too recent (no events after that time)
2. Portal addresses incorrect or empty
3. No events indexed for those contracts
4. Network/chain ID mismatch

**Solution:**
1. Try `since: BigInt(0)` to query all historical data
2. Verify portal addresses match deployed contracts
3. Check indexer has indexed the target chains
4. Confirm events exist on-chain

## Migration Guide

### From ChainListener to Indexer

If migrating from real-time listeners to indexer queries:

**ChainListener (Real-time):**
```typescript
// WebSocket-based, low latency
chainListener.on('IntentPublished', (event) => {
  processEvent(event);
});
```

**IndexerService (Historical):**
```typescript
// Polling-based, reliable
const since = getLastTimestamp();
for await (const batch of indexerService.queryPublishedIntents({
  portalAddresses,
  since,
})) {
  for (const intent of batch) {
    processIntent(intent);
  }
  updateLastTimestamp(batch[batch.length - 1].blockTimestamp);
}
```

### Combining Both Approaches

For redundancy, use both listeners and indexer:

```typescript
@Injectable()
export class EventProcessor {
  constructor(
    private readonly chainListener: ChainListener,
    @Optional() private readonly indexerService?: IndexerService,
  ) {}

  async start() {
    // Start real-time listener
    await this.chainListener.start();

    // Start periodic indexer polling (backup)
    if (this.indexerService) {
      this.startIndexerPolling();
    }
  }

  private startIndexerPolling() {
    setInterval(async () => {
      const since = this.getLastProcessedTimestamp();
      for await (const batch of this.indexerService.queryPublishedIntents({
        portalAddresses: this.getPortalAddresses(),
        since,
      })) {
        // Queue events (deduplication handled by queue)
        await this.queueEvents(batch);
      }
    }, 5000); // 5s interval
  }
}
```

## Related Modules

- **EVM Module** (`src/modules/blockchain/evm/`): Parent module
- **ChainListener** (`src/modules/blockchain/evm/listeners/`): Real-time event listener
- **Queue Module** (`src/modules/queue/`): Event processing queue
- **Config Module** (`src/modules/config/`): Configuration management

## Future Enhancements

1. **Caching**: Add Redis cache for recent queries
2. **Retry Logic**: Implement exponential backoff for failed requests
3. **Metrics**: Track query performance and success rates
4. **Webhooks**: Subscribe to real-time updates from indexer
5. **Type Generation**: Use GraphQL Code Generator for automatic type updates
6. **Batch Queries**: Combine multiple queries into single GraphQL request

## References

- **Ponder.sh Documentation**: https://ponder.sh/
- **GraphQL Request Library**: https://github.com/onfido/graphql-request
- **Indexer Endpoint**: https://indexer.eco.com/
