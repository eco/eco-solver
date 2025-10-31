# E2E Testing Guide

## Overview

This directory contains end-to-end tests for the blockchain intent solver. Tests run against forked mainnet chains (Base and Optimism) using Anvil, with real smart contracts and blockchain interactions.

## Architecture

### Per-File App Instance Pattern

Each E2E test file creates its **own NestJS application instance** for better test isolation:

- App is created once per test file in `beforeAll()`
- App is explicitly closed in `afterAll()` after tests complete
- Each test file is independent and manages its own lifecycle
- Tests within a file share the same app instance for performance

**Important**: Always call the cleanup function in `afterAll()` to properly close the app!

### Test Execution Order

Tests run **sequentially** (not in parallel):
- Jest is configured with `maxWorkers: 1`
- Tests execute in alphabetical order
- State persists across tests (by design)
- No database/state cleanup between tests

## Writing Tests

### Basic Test Structure

```typescript
import { E2ETestContext, setupTestContext } from './context/test-context';
import { E2E_TIMEOUTS } from './config/timeouts';

describe('My E2E Test Suite', () => {
  let ctx: E2ETestContext;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    // Create app instance and get cleanup function
    const result = await setupTestContext();
    ctx = result.context;
    cleanup = result.cleanup;
  }, E2E_TIMEOUTS.BEFORE_ALL);

  // Always cleanup after tests
  afterAll(async () => {
    await cleanup();
  }, E2E_TIMEOUTS.AFTER_ALL);

  it('should do something', async () => {
    // Access app, services, etc. via ctx
    const { app, baseUrl, intentsService } = ctx;
    // Your test code
  });
});
```

### Using Test Utilities

#### Publishing Intents

```typescript
import { publishIntent } from './utils';
import { createValidIntentOptions, createExpiredIntentOptions } from './fixtures/intent-fixtures';

// Publish with defaults (10 USDC Base → Optimism)
const { intentHash } = await publishIntent();

// Use pre-configured fixtures
const result = await publishIntent(createValidIntentOptions());
const expired = await publishIntent(createExpiredIntentOptions());

// Custom parameters
const custom = await publishIntent({
  tokenAmount: parseUnits('20', 6),
  rewardTokenAmount: parseUnits('25', 6),
});
```

#### Waiting for Intent Status

```typescript
import { waitForFulfillment, waitForRejection, waitForStatus } from './utils';

// Wait for fulfillment (polls database with exponential backoff)
await waitForFulfillment(intentHash);

// Wait and verify rejection
await waitForRejection(intentHash);

// Wait for specific status
await waitForStatus(intentHash, IntentStatus.FAILED);
```

#### Assertions

```typescript
import { expectIntentFulfilled, expectIntentNotFulfilled, expectBalanceIncreased } from './utils';

// Assert intent was fulfilled
await expectIntentFulfilled(intentHash);

// Assert intent was NOT fulfilled
await expectIntentNotFulfilled(intentHash);

// Assert balance increased
expectBalanceIncreased(finalBalance, initialBalance, expectedIncrease, 'USDC');
```

#### Polling Utilities

```typescript
import { pollUntil, pollUntilDefined, pollUntilTrue } from './utils';

// Generic polling with custom predicate
const result = await pollUntil(
  () => getStatus(),
  (status) => status === 'ready',
  { timeout: 10000 }
);

// Poll until value is defined
const intent = await pollUntilDefined(
  () => intentsService.findById(hash)
);

// Poll until condition is true
await pollUntilTrue(
  async () => (await getBalance()) > threshold
);
```

### Available Test Fixtures

Pre-configured intent options for common scenarios:

```typescript
import {
  createValidIntentOptions,
  createExpiredIntentOptions,
  createInsufficientFundingOptions,
  createInvalidProverOptions,
  createLargeAmountOptions,
  createMinimalAmountOptions,
  futureTimestamp,
  pastTimestamp,
} from './fixtures/intent-fixtures';

// Valid intent (should be fulfilled)
await publishIntent(createValidIntentOptions());

// Expired deadline (should be rejected)
await publishIntent(createExpiredIntentOptions());

// Insufficient funding (should be rejected)
await publishIntent(createInsufficientFundingOptions());

// Invalid prover (should be rejected)
await publishIntent(createInvalidProverOptions());

// Custom deadline
await publishIntent({
  routeDeadline: futureTimestamp(60), // 60 seconds from now
  rewardDeadline: futureTimestamp(120), // 2 minutes from now
});
```

## Test Infrastructure

### Global Setup (`globalSetup.ts`)

Runs once before all tests:
1. Starts MongoDB and Redis (via Testcontainers or CI services)
2. Starts two Anvil instances (Base and Optimism mainnet forks)
3. Sets environment variables for dynamic ports
4. Waits for all services to be ready

### Global Teardown (`globalTeardown.ts`)

Runs once after all tests:
1. Stops Anvil instances
2. Stops database containers
3. Cleans up temporary files

Note: Each test file handles its own app cleanup via `afterAll()` hooks.

### Test Configuration

Two Jest configurations available:

1. **jest-e2e.json** - Uses Testcontainers (for local development)
   ```bash
   pnpm test:e2e:ci
   ```

2. **jest-e2e-compose.json** - Uses Docker Compose (default)
   ```bash
   pnpm test:e2e
   ```

## Running Tests

### Prerequisites

1. Docker running (for Testcontainers or Docker Compose)
2. Environment configured in `test/config.e2e.yaml`

### Run All E2E Tests

```bash
# Using Docker Compose (recommended)
pnpm test:e2e

# Using Testcontainers (CI mode)
pnpm test:e2e:ci

# Run specific test file
pnpm test:e2e --testPathPattern=fulfillment-flow

# With coverage
pnpm test:e2e --coverage
```

### Debugging Tests

```bash
# Run with verbose output (already enabled in config)
pnpm test:e2e

# Check for open handles (memory leaks)
pnpm test:e2e --detectOpenHandles

# Run single test
pnpm test:e2e --testNamePattern="fulfills valid cross-chain transfer"
```

## Test Helpers Reference

### Core Helpers

- `setupTestContext()` - Create app instance and return context with cleanup function
- `waitForApp(baseUrl)` - Wait for app to be ready
- `fundTestAccountsWithUSDC()` - Fund test accounts with USDC
- `fundKernelWallet()` - Fund the executor's Kernel wallet

### Intent Helpers

- `publishIntent(options)` - Publish and fund an intent on-chain
- `IntentBuilder` - Low-level builder for custom intent construction

### Wait Helpers

- `waitForDetection(hash)` - Wait for solver to detect intent
- `waitForFulfillment(hash)` - Wait for intent to be fulfilled
- `waitForRejection(hash)` - Wait and verify intent NOT fulfilled
- `waitForStatus(hash, status)` - Wait for specific status

### Verification Helpers

- `verifyIntentStatus(hash, status)` - Verify intent has expected status
- `verifyNotFulfilled(hash)` - Verify intent was NOT fulfilled
- `verifyNoFulfillmentEvent(hash)` - Verify no fulfillment event on chain
- `verifyTokensDelivered(hash, recipient)` - Verify tokens were delivered

### Balance Tracking

```typescript
import { BalanceTracker } from './utils';

const tracker = new BalanceTracker(chainId, tokenAddress, recipientAddress);
await tracker.snapshot(); // Save initial balance

// ... execute intent ...

await tracker.verifyIncreased(expectedAmount); // Assert balance increased
```

## Troubleshooting

### Port Already in Use

If you see port 3001 conflicts:
1. Ensure previous test runs properly closed the app (check `afterAll()` hooks)
2. Kill any stale processes: `lsof -ti:3001 | xargs kill -9`

### Tests Timing Out

- Default timeout is now 30 seconds (reduced from 120s)
- Polling uses exponential backoff (starts at 100ms)
- Individual tests can override: `it('test', async () => { ... }, 60000)`

### Database Connection Errors

Ensure MongoDB and Redis are running:
```bash
docker ps  # Check containers are running
```

### Anvil Fork Issues

```bash
# Check Anvil processes
ps aux | grep anvil

# Manually kill if needed
pkill -9 anvil
```

### Test Fails Only in CI

Check if CI environment variables are set correctly:
- GitHub Actions uses service containers
- TestContainersManager auto-detects CI and adapts

## Best Practices

### DO:
- ✅ Use `setupTestContext()` pattern with cleanup function
- ✅ Always call cleanup in `afterAll()` hooks
- ✅ Use fixtures for common test scenarios
- ✅ Use polling utilities instead of `setTimeout`
- ✅ Write descriptive test names
- ✅ Add console logging for debugging
- ✅ Test both success and failure paths

### DON'T:
- ❌ Don't forget to call cleanup in `afterAll()`
- ❌ Don't create app instances manually (use `setupTestContext()`)
- ❌ Don't use hard-coded `setTimeout` - use polling
- ❌ Don't assume test order (even though sequential)
- ❌ Don't commit changes to `config.e2e.yaml` with local addresses

## Adding New Test Files

Template for new test file:

```typescript
import { E2ETestContext, setupTestContext } from './context/test-context';
import { E2E_TIMEOUTS } from './config/timeouts';

describe('My New Test Suite', () => {
  let ctx: E2ETestContext;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const result = await setupTestContext();
    ctx = result.context;
    cleanup = result.cleanup;

    // Initialize any additional helpers or perform setup
  }, E2E_TIMEOUTS.BEFORE_ALL);

  afterAll(async () => {
    await cleanup();
  }, E2E_TIMEOUTS.AFTER_ALL);

  describe('Feature Area', () => {
    it('should handle valid scenario', async () => {
      const { app, baseUrl, intentsService } = ctx;
      // Test code
    });

    it('should reject invalid scenario', async () => {
      const { app, baseUrl, intentsService } = ctx;
      // Test code
    });
  });
});
```

## Performance Tips

1. **Use fixtures** - Pre-configured options reduce boilerplate
2. **Polling efficiency** - Exponential backoff reduces database queries
3. **Shared app within file** - App starts once per file, shared by all tests in that file
4. **Parallel assertions** - Use `Promise.all()` where possible
5. **Smart timeouts** - Override defaults only when needed

## Test Coverage Goals

Current coverage:
- ✅ Valid cross-chain transfers
- ✅ Insufficient funding rejection
- ✅ Expired deadline rejection
- ✅ Invalid prover rejection
- ✅ Health endpoints
- ✅ Blockchain connectivity
- ✅ Database connectivity

Future coverage needed:
- ⏳ Different fulfillment strategies
- ⏳ API endpoints (quotes, validation)
- ⏳ Different wallet types (basic vs kernel)
- ⏳ Solana (SVM) and TRON (TVM) chains
- ⏳ Queue processing edge cases
- ⏳ Concurrent intent processing
- ⏳ Error recovery scenarios

## Configuration

### Test Configuration (`test/config.e2e.yaml`)

- App port: 3001 (different from dev: 3000)
- MongoDB: Dynamic port from Testcontainers
- Redis: Dynamic port from Testcontainers
- Anvil forks: Base (8545), Optimism (9545)
- Listeners: Enabled for fulfillment flow tests

### Environment Variables

Set by `globalSetup.ts`:
- `MONGODB_URI` - Dynamic MongoDB connection
- `REDIS_HOST` - Dynamic Redis host
- `REDIS_PORT` - Dynamic Redis port
- `PORT` - App server port (3001)

## Links

- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Jest E2E Testing](https://jestjs.io/docs/testing-frameworks)
- [Testcontainers](https://testcontainers.com/)
- [Viem Testing](https://viem.sh/docs/introduction)
