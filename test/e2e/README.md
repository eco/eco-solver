# E2E Testing Guide

## Quick Start

```bash
# 1. Start Docker (required for MongoDB, Redis, and Anvil forks)
docker-compose up -d

# 2. Run all E2E tests
pnpm test:e2e

# 3. Run specific test file
pnpm test:e2e --testPathPattern=fulfillment-flow

# 4. Clean up after tests
docker-compose down
```

## Overview

This directory contains end-to-end tests for the blockchain intent solver. Tests run against forked mainnet chains (Base and Optimism) using Anvil, with real smart contracts and blockchain interactions.

### Key Characteristics

- **Real blockchain interactions**: Uses Anvil forks of Base and Optimism mainnet
- **Sequential execution**: Tests run one at a time in alphabetical order
- **Persistent state**: Database and blockchain state accumulate during test run
- **Per-file app instances**: Each test file creates its own NestJS app
- **Full integration**: Tests the entire system end-to-end (listeners, queues, executors)

## Directory Structure

```
test/e2e/
├── README.md                    # This file
├── config/
│   └── timeouts.ts              # Timeout constants
├── context/
│   └── test-context.ts          # App setup and context creation
├── fixtures/
│   └── intent-fixtures.ts       # Pre-configured intent options
├── helpers/
│   ├── intent.helper.ts         # Intent publishing and building
│   ├── test-app.helper.ts       # App initialization
│   └── verification.helper.ts   # Assertion helpers
├── utils/
│   ├── balance-tracker.ts       # Balance verification
│   ├── index.ts                 # Exported utilities
│   ├── polling.utils.ts         # Polling functions
│   └── wait.utils.ts            # Wait helpers
├── globalSetup.ts               # Pre-test infrastructure setup
├── globalTeardown.ts            # Post-test cleanup
└── *.e2e-spec.ts                # Test files (run alphabetically)
```

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
- Test files execute in alphabetical order by filename
- This ensures predictable execution and easier debugging
- Parallel execution is disabled due to shared blockchain state and database

### State Persistence

**Important**: State persists across test files:
- **Blockchain state**: Anvil forks persist transactions between tests
- **Database state**: MongoDB data is NOT cleared between test files
- **Intent history**: Previously published intents remain in the database
- **Account balances**: Change as tests execute transactions

This is **by design** to simulate a real-world environment where state accumulates. Tests should be written to handle existing state (e.g., check balance increases rather than absolute values).

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

### Creating New Fixtures

To add new intent fixture functions:

1. Add function to `test/e2e/fixtures/intent-fixtures.ts`
2. Follow naming convention: `create<Scenario>Options()`
3. Return partial `PublishIntentOptions` object
4. Document the expected behavior in comments

Example:
```typescript
/**
 * Creates options for an intent with multiple tokens
 * Expected behavior: Should be fulfilled successfully
 */
export function createMultiTokenIntentOptions(): Partial<PublishIntentOptions> {
  return {
    routeTokens: [
      { address: USDC_BASE, amount: parseUnits('10', 6) },
      { address: WETH_BASE, amount: parseUnits('0.1', 18) },
    ],
    // ... other overrides
  };
}
```

## Test Data Management

### Resetting Test Data

Test data persists across runs. To reset:

```bash
# Stop all services
docker-compose down

# Remove volumes (clears MongoDB and Redis data)
docker-compose down -v

# Restart for clean state
docker-compose up -d
```

### Managing Blockchain State

Anvil forks start from the same block each time, but transactions persist during a test run:
- **Between tests in same file**: State accumulates
- **Between different test files**: State accumulates
- **Between test runs**: Reset (Anvil restarts)

To work with accumulated state:
- Use relative assertions (balance increased by X)
- Don't assume specific absolute values
- Check existence before creating test data

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

**Cleanup Behavior:**
- Each test file handles its own app cleanup via `afterAll()` hooks
- If a test file crashes or times out, the app may not close properly
- This can cause port conflicts for subsequent test runs
- Use `lsof -ti:3001 | xargs kill -9` to clean up stale processes
- Global teardown (`globalTeardown.ts`) always runs to clean up Anvil and containers

### Test Configuration

Two Jest configurations available:

1. **jest-e2e-compose.json** - Uses Docker Compose (default, recommended for local development)
   - Command: `pnpm test:e2e`
   - Services managed by `docker-compose.yml`
   - Predictable ports and setup
   - Best for local development

2. **jest-e2e.json** - Uses Testcontainers (for CI/automated environments)
   - Command: `pnpm test:e2e:ci`
   - Services auto-provisioned via Testcontainers
   - Dynamic ports assigned automatically
   - Best for CI pipelines and isolated environments

## Running Tests

### Prerequisites

1. **Docker Desktop** running (required for MongoDB, Redis, and Anvil)
2. **Node.js** and **pnpm** installed
3. **Configuration file**: `test/config.e2e.yaml` at the project root
4. **Environment variables**: Set automatically by `globalSetup.ts`
5. **Foundry/Anvil**: Installed for blockchain forking (usually via Foundry CLI)

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

# Inspect app logs during tests
# Logs are output to console during test execution

# Check Anvil blockchain state
# Anvil runs at http://localhost:8545 (Base) and http://localhost:9545 (Optimism)
cast block-number --rpc-url http://localhost:8545

# Check MongoDB data
# Connect to MongoDB at the URI shown in test output
mongosh <MONGODB_URI_FROM_TEST_OUTPUT>

# Check Redis data
redis-cli -h localhost -p <REDIS_PORT_FROM_TEST_OUTPUT>

# Debug failed intent
# Check intent status in database
# Check blockchain event logs
# Verify account balances
```

## Test Helpers Reference

### Core Helpers

- `setupTestContext()` - Create app instance and return context with cleanup function
- `waitForApp(baseUrl)` - Wait for app to be ready
- `fundTestAccountsWithUSDC()` - Fund test accounts with USDC
- `fundKernelWallet()` - Fund the executor's Kernel wallet

### Intent Helpers

- `publishIntent(options)` - Publish and fund an intent on-chain (high-level, recommended)
- `IntentBuilder` - Low-level builder for custom intent construction
  - Use when you need fine-grained control over intent parameters
  - Use `publishIntent()` for most test scenarios

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

// Create tracker with chain ID, token address, and wallet address
const tracker = new BalanceTracker(
  10n,                    // chainId (bigint): Chain to check balance on
  '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // tokenAddress: ERC20 token to track
  '0x...'                 // walletAddress: Address to monitor
);

await tracker.snapshot(); // Save initial balance

// ... execute intent ...

await tracker.verifyIncreased(expectedAmount); // Assert balance increased by expected amount
```

### Helper Selection Guide

**When to use each helper:**

- **`publishIntent()`** - Most common, use for standard intent publishing
- **`IntentBuilder`** - Only when you need custom intent construction not supported by publishIntent
- **`waitForFulfillment()`** - When you expect the intent to succeed
- **`waitForRejection()`** - When you expect the intent to fail validation
- **`waitForStatus()`** - When you need to wait for a specific status (e.g., FAILED, PENDING)
- **`expectIntentFulfilled()`** - For final assertions on successful intents
- **`expectIntentNotFulfilled()`** - For final assertions on failed intents
- **`BalanceTracker`** - When you need to verify token transfers occurred
- **`pollUntil*()`** - For custom polling scenarios not covered by wait helpers

## Troubleshooting

### Port Already in Use

If you see port 3001 conflicts:
1. Ensure previous test runs properly closed the app (check `afterAll()` hooks)
2. Kill any stale processes: `lsof -ti:3001 | xargs kill -9`

### Tests Timing Out

- Check `test/e2e/config/timeouts.ts` for current timeout values
- Polling uses exponential backoff (starts at 100ms, doubles each attempt)
- Individual tests can override: `it('test', async () => { ... }, 60000)`
- Common causes:
  - Blockchain listener not detecting events (check logs)
  - Queue processor not running (verify Redis connection)
  - Anvil fork issues (restart Anvil processes)
  - Intent validation failing silently (check validation logs)

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
- GitHub Actions uses service containers or Testcontainers
- TestContainersManager auto-detects CI environment
- Verify CI has access to required Docker images
- Check CI logs for service startup errors

## CI/CD Integration

### GitHub Actions Setup

E2E tests can run in CI using either approach:

**Option 1: Service Containers** (faster)
```yaml
services:
  mongodb:
    image: mongo:latest
    ports:
      - 27017:27017
  redis:
    image: redis:latest
    ports:
      - 6379:6379
```

**Option 2: Testcontainers** (more isolated)
```yaml
- run: pnpm test:e2e:ci
```

### Required Environment Variables

CI must set these environment variables:
- `CI=true` - Enables CI-specific behavior
- Database/Redis URLs (if using service containers)
- Foundry/Anvil must be available in CI environment

### CI Differences from Local

- **Dynamic ports**: Testcontainers assigns random ports
- **No Docker Compose**: Uses Testcontainers instead
- **Cleanup**: Automatic container cleanup after tests
- **Timeouts**: May need longer timeouts for cold starts

## Best Practices

### DO:
- ✅ Use `setupTestContext()` pattern with cleanup function
- ✅ Always call cleanup in `afterAll()` hooks
- ✅ Use fixtures for common test scenarios
- ✅ Use polling utilities instead of `setTimeout`
- ✅ Write descriptive test names
- ✅ Add console logging for debugging
- ✅ Test both success and failure paths
- ✅ Use relative balance assertions (increased by X, not equals X)
- ✅ Name test files with descriptive names (they run alphabetically)
- ✅ Reset test data when needed (`docker-compose down -v`)

### DON'T:
- ❌ Don't forget to call cleanup in `afterAll()`
- ❌ Don't create app instances manually (use `setupTestContext()`)
- ❌ Don't use hard-coded `setTimeout` - use polling utilities
- ❌ Don't assume test file execution order (use alphabetical naming)
- ❌ Don't commit changes to `config.e2e.yaml` with local addresses or secrets
- ❌ Don't assume absolute balance values (state accumulates)
- ❌ Don't rely on database being empty (handle existing data)
- ❌ Don't run tests in parallel (configured for sequential execution)

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

### Test Configuration File

**Location**: `test/config.e2e.yaml` (in the project root's `test/` directory)

This file configures all E2E test settings:
- **App port**: 3001 (different from dev: 3000)
- **MongoDB**: Connection URI (set dynamically by globalSetup)
- **Redis**: Host and port (set dynamically by globalSetup)
- **Anvil forks**: Base (8545), Optimism (9545)
- **Listeners**: Enabled for blockchain event detection
- **Wallets**: Test executor wallets (basic, kernel)
- **Provers**: Prover contracts and configurations

**Important**: Do NOT commit changes to `config.e2e.yaml` with local addresses or secrets.

### Environment Variables

These are set automatically by `globalSetup.ts`:
- `MONGODB_URI` - Dynamic MongoDB connection string
- `REDIS_HOST` - Redis hostname (usually localhost)
- `REDIS_PORT` - Dynamic Redis port
- `PORT` - App server port (3001)

The configuration system merges:
1. Base config from `config.e2e.yaml`
2. Environment variables (set by globalSetup)
3. Any test-specific overrides

### Configuration Precedence

1. Environment variables (highest priority)
2. `config.e2e.yaml` settings
3. Default values from config schemas

## Links

- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Jest E2E Testing](https://jestjs.io/docs/testing-frameworks)
- [Testcontainers](https://testcontainers.com/)
- [Viem Testing](https://viem.sh/docs/introduction)
