# Test Directory

This directory contains all test files for the blockchain intent-solver application.

## Test Types

### Unit Tests (`src/**/*.spec.ts`)

- Located alongside source files
- Test individual functions, classes, and modules in isolation
- Run with: `pnpm test`

### E2E Tests (`test/e2e/**/*.e2e.spec.ts`)

- Full application integration tests
- Uses real databases (MongoDB, Redis) and forked blockchain networks
- Run with: `pnpm test:e2e` (uses Docker Compose) or `pnpm test:e2e:ci` (uses Testcontainers)
- See [test/e2e/README.md](./e2e/README.md) for comprehensive E2E testing guide

## E2E Test Setup

### Prerequisites

1. **Docker** - Required for Testcontainers (MongoDB and Redis)
2. **Foundry** - Required for Anvil (blockchain forks)
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

### Quick Start

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Update contract addresses**
   Edit `test/config.e2e.yaml` and replace placeholder contract addresses with actual deployed contracts on Base Sepolia and Optimism Sepolia.

3. **Run E2E tests**
   ```bash
   pnpm test:e2e
   ```

### Test Execution Modes

E2E tests support two execution modes:

1. **Docker Compose Mode (Default)**
   - Command: `pnpm test:e2e`
   - Uses `jest-e2e-compose.json` configuration
   - Requires Docker Compose for MongoDB and Redis
   - Best for local development
   - Faster startup with pre-configured services

2. **Testcontainers Mode (CI)**
   - Command: `pnpm test:e2e:ci`
   - Uses `jest-e2e.json` configuration
   - Uses Testcontainers library for MongoDB and Redis
   - Best for CI environments
   - Automatic container management and cleanup

Both modes use Anvil for blockchain forks and share the same test configuration (`config.e2e.yaml`).

### Configuration Files

- `config.e2e.yaml` - E2E test configuration (YAML format, aligns with production config)
- `jest-e2e.json` - Jest configuration for E2E tests (Testcontainers mode for CI)
- `jest-e2e-compose.json` - Jest configuration for E2E tests (Docker Compose mode, default)

### Test Structure

```
test/
├── e2e/
│   ├── setup/
│   │   ├── globalSetup.ts               # Starts services before all tests (Testcontainers)
│   │   ├── globalSetup.compose.ts       # Starts services before all tests (Docker Compose)
│   │   ├── globalTeardown.ts            # Cleans up after all tests (Testcontainers)
│   │   ├── globalTeardown.compose.ts    # Cleans up after all tests (Docker Compose)
│   │   ├── anvil-manager.ts             # Manages Anvil blockchain forks
│   │   ├── test-containers.ts           # Manages Docker containers
│   │   └── waitFor.ts                   # Health check utilities
│   ├── helpers/
│   │   ├── test-app.helper.ts           # NestJS app bootstrap helpers
│   │   ├── e2e-config.ts                # E2E configuration loader
│   │   ├── fund-test-account.ts         # Test account funding utilities
│   │   └── intent-builder.helper.ts     # Intent construction helper
│   ├── context/
│   │   └── test-context.ts              # Test context setup and management
│   ├── config/
│   │   └── timeouts.ts                  # E2E timeout constants
│   ├── fixtures/
│   │   └── intent-fixtures.ts           # Pre-configured test data and intent options
│   ├── utils/
│   │   ├── balance-tracker.ts           # Balance tracking utilities
│   │   ├── polling.ts                   # Polling utilities for async operations
│   │   ├── assertions.ts                # Custom test assertions
│   │   ├── wait-helpers.ts              # Wait for specific conditions
│   │   └── verification.ts              # Intent verification helpers
│   ├── README.md                        # Comprehensive E2E testing guide
│   └── *.e2e.spec.ts                    # E2E test files
├── config.e2e.yaml                      # E2E configuration
├── jest-e2e.json                        # Jest E2E config (Testcontainers)
├── jest-e2e-compose.json                # Jest E2E config (Docker Compose, default)
└── README.md                            # This file
```

## Writing Tests

### Unit Test Example

```typescript
describe('MyService', () => {
  let service: MyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [MyService],
    }).compile();

    service = module.get<MyService>(MyService);
  });

  it('should do something', () => {
    expect(service.doSomething()).toBe(true);
  });
});
```

### E2E Test Example

```typescript
import { E2ETestContext, setupTestContext } from './context/test-context';
import { E2E_TIMEOUTS } from './config/timeouts';

describe('My E2E Test', () => {
  let ctx: E2ETestContext;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const result = await setupTestContext();
    ctx = result.context;
    cleanup = result.cleanup;
  }, E2E_TIMEOUTS.BEFORE_ALL);

  afterAll(async () => {
    await cleanup();
  }, E2E_TIMEOUTS.AFTER_ALL);

  it('should test endpoint', async () => {
    const { app } = ctx;
    await request(app.getHttpServer()).get('/health').expect(200);
  });
});
```

**Note:** For detailed examples including intent publishing, validation, and advanced patterns, see [test/e2e/README.md](./e2e/README.md).

## Troubleshooting

### "Cannot connect to Docker daemon"

- Ensure Docker Desktop is running
- Check Docker has sufficient resources

### "Timeout waiting for Anvil"

- Verify Foundry is installed: `anvil --version`
- Check RPC URL is accessible
- Try with different RPC provider

### "Port already in use"

- Check ports 8545, 9545, 27017, 6379 are available
- Stop conflicting services: `lsof -i :8545`

## Documentation

For detailed documentation, see:

- **[test/e2e/README.md](./e2e/README.md)** - **Comprehensive E2E testing guide** (fixtures, utilities, polling, assertions, best practices)
- [E2E Setup Guide](../docs/e2e-setup.md) - Infrastructure setup and troubleshooting
- [Project README](../README.md) - Project overview and architecture

## CI/CD

E2E tests run automatically in GitHub Actions on push/PR. See `.github/workflows/e2e.yml` for the workflow configuration.

Required secrets:

- `BASE_MAINNET_RPC_URL` - Alchemy RPC URL for Base Sepolia fork
- `OP_MAINNET_RPC_URL` - Alchemy RPC URL for Optimism Sepolia fork
