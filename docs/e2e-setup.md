# E2E Test Environment Setup

This document explains how to set up and run the end-to-end (E2E) test environment for the blockchain intent-solver application.

## Overview

The E2E test environment provides a complete, isolated testing setup that includes:

- **MongoDB** - Database for intent persistence
- **Redis** - Queue and caching infrastructure
- **Base Mainnet Fork** - Anvil fork running on `localhost:8545`
- **Optimism Mainnet Fork** - Anvil fork running on `localhost:9545`
- **NestJS Application** - Full application stack with all modules

## Architecture

### Test Orchestration

The E2E tests use Jest with global setup/teardown hooks:

1. **Global Setup** (`test/e2e/setup/globalSetup.ts`)
   - Starts MongoDB and Redis (Testcontainers locally, GitHub services in CI)
   - Launches two Anvil instances forking Base Mainnet and Optimism Mainnet
   - Updates `test/config.e2e.yaml` with dynamic connection details
   - Verifies all services are healthy before tests run

2. **Global Teardown** (`test/e2e/setup/globalTeardown.ts`)
   - Stops all Anvil instances
   - Stops containers (local only)
   - Cleans up temporary files

3. **Test Execution**
   - Jest runs E2E tests in a single worker (`--runInBand`)
   - Tests interact with the full NestJS application
   - Blockchain interactions use real forked networks (no mocks)

### Environment Detection

The setup automatically detects whether it's running locally or in CI:

- **Local**: Uses Testcontainers to manage MongoDB and Redis
- **CI**: Uses GitHub Actions services for MongoDB and Redis
- **Both**: Anvil instances are launched as background processes

## Prerequisites

### Local Development

1. **Node.js 20+** and **pnpm 9.11.0**
2. **Docker** - Required for Testcontainers
3. **Foundry** - Required for Anvil
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

### CI Environment

1. **GitHub Secrets** - Configure the following secrets in your repository:
   - `BASE_MAINNET_RPC_URL` - Alchemy RPC URL for Base Mainnet
   - `OP_MAINNET_RPC_URL` - Alchemy RPC URL for Optimism Mainnet

## Configuration

### Test Configuration File

The E2E tests use `test/config.e2e.yaml` for application configuration. This file:

- Contains all application settings for the test environment
- Includes placeholders (`{{MONGODB_URI}}`, `{{REDIS_HOST}}`, `{{REDIS_PORT}}`) that are dynamically replaced during setup
- Uses test wallet keys (Anvil's default accounts - safe to commit)
- References existing contracts deployed on Base Mainnet and Optimism Mainnet

**IMPORTANT**: Before running E2E tests, update the contract addresses in `test/config.e2e.yaml`:

```yaml
evm:
  networks:
    - chainId: 8453  # Base Mainnet
      contracts:
        portal: "0xYourPortalAddress"  # Replace with actual deployed contract
        # ... other contracts
    - chainId: 10  # Optimism Mainnet
      contracts:
        portal: "0xYourPortalAddress"  # Replace with actual deployed contract
```

### Environment Variables

For local development, you can set:

```bash
export BASE_MAINNET_RPC_URL="https://base-sepolia.g.alchemy.com/v2/YOUR_KEY"
export OP_MAINNET_RPC_URL="https://opt-sepolia.g.alchemy.com/v2/YOUR_KEY"
```

Or use the defaults (public endpoints with rate limits).

## Running E2E Tests

### Local Execution

#### Option 1: Automated Setup (Recommended)

This is the simplest way - Jest handles everything:

```bash
# Install dependencies
pnpm install

# Run E2E tests
pnpm test:e2e
```

The `test:e2e` script will:
1. Start MongoDB and Redis containers
2. Launch Anvil forks
3. Run all E2E tests
4. Clean up all resources

#### Option 2: Manual Docker Compose

If you prefer managing services manually:

```bash
# Start services
docker-compose -f docker-compose.e2e.yml up -d

# Wait for services to be ready
docker-compose -f docker-compose.e2e.yml ps

# Run tests (will use running services)
pnpm test:e2e

# Stop services
docker-compose -f docker-compose.e2e.yml down
```

### CI Execution

E2E tests run automatically on push/PR via GitHub Actions (`.github/workflows/e2e.yml`).

The workflow:
1. Uses GitHub Actions services for MongoDB and Redis
2. Installs Foundry and launches Anvil forks
3. Runs `pnpm test:e2e`
4. Uploads test results and logs as artifacts

## Test Structure

```
test/
├── e2e/
│   ├── setup/
│   │   ├── globalSetup.ts        # Jest global setup
│   │   ├── globalTeardown.ts     # Jest global teardown
│   │   ├── anvil-manager.ts      # Anvil process management
│   │   ├── test-containers.ts    # Testcontainers orchestration
│   │   └── waitFor.ts            # Health check utilities
│   ├── helpers/
│   │   └── test-app.helper.ts    # NestJS app bootstrap helpers
│   └── app.e2e.spec.ts           # Example E2E test suite
├── config.e2e.yaml               # E2E test configuration
└── jest-e2e.json                 # Jest E2E configuration
```

## Writing E2E Tests

### Basic Test Template

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestAppWithServer, waitForApp } from './helpers/test-app.helper';

describe('My E2E Test', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const result = await createTestAppWithServer();
    app = result.app;
    baseUrl = result.baseUrl;
    await waitForApp(baseUrl);
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should test something', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
  });
});
```

### Blockchain Interaction Example

```typescript
import { createPublicClient, http, parseEther } from 'viem';
import { TEST_RPC, TEST_ACCOUNTS } from './helpers/test-app.helper';

it('should interact with Base Mainnet fork', async () => {
  const client = createPublicClient({
    transport: http(TEST_RPC.BASE_MAINNET),
  });

  const balance = await client.getBalance({
    address: TEST_ACCOUNTS.ACCOUNT_0.address,
  });

  expect(balance).toBeGreaterThan(parseEther('100'));
});
```

## Troubleshooting

### Anvil Not Starting

**Symptom**: Tests timeout waiting for Anvil

**Solutions**:
1. Verify Foundry is installed: `anvil --version`
2. Check fork URL is accessible: `curl $BASE_MAINNET_RPC_URL`
3. Try with a different RPC provider
4. Check Anvil logs: `test/e2e/setup/globalSetup.ts` saves PIDs and outputs

### Containers Not Starting

**Symptom**: Tests fail with "Cannot connect to MongoDB/Redis"

**Solutions**:
1. Ensure Docker is running: `docker ps`
2. Check Docker has sufficient resources (memory, disk)
3. Clean up old containers: `docker system prune`
4. Verify Testcontainers can access Docker socket

### Port Conflicts ⚠️ Most Common Issue

**Symptom**: "Address already in use (os error 48)" errors

**Quick Fix**:
```bash
# Run the cleanup script
pnpm test:e2e:cleanup

# Then run tests
pnpm test:e2e:services
```

**Why it happens**: Anvil processes from previous test runs may not have been killed properly, especially when tests are interrupted or fail.

**What the cleanup script does**:
- Kills all Anvil processes system-wide
- Frees up ports 8545 and 9545
- Stops all E2E Docker containers
- Removes temporary test files

**Manual Solutions** (if cleanup script doesn't work):
1. Kill all Anvil processes: `pkill -9 anvil`
2. Kill processes on specific ports: `lsof -ti:8545,9545 | xargs kill -9`
3. Check if ports are free: `lsof -i :8545 && lsof -i :9545`
4. Change ports in `test/config.e2e.yaml` if needed

### Test Timeout

**Symptom**: Tests exceed 60 second timeout

**Solutions**:
1. Increase timeout in test: `beforeAll(async () => { ... }, 120000)`
2. Check network connectivity to fork URLs
3. Use a faster RPC provider
4. Reduce the number of parallel operations

## Test Accounts

The E2E tests use Anvil's default test accounts (funded with 10,000 ETH each):

| Account | Address | Private Key | Purpose |
|---------|---------|-------------|---------|
| Account 0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac097...` | Solver/Executor |
| Account 1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c69...` | Test User |
| Account 2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de41...` | Test User |

These are **TEST KEYS ONLY** and should never be used with real funds.

## Network Configuration

### Base Mainnet Fork
- **Chain ID**: 8453
- **Local RPC**: `http://localhost:8545`
- **Fork Source**: Alchemy Base Mainnet endpoint

### Optimism Mainnet Fork
- **Chain ID**: 10
- **Local RPC**: `http://localhost:9545`
- **Fork Source**: Alchemy Optimism Mainnet endpoint

## Best Practices

1. **Use Existing Contracts**: E2E tests fork real testnets, so use contracts already deployed there
2. **Deterministic Tests**: Tests should be idempotent and work regardless of execution order
3. **Cleanup**: Always close the app in `afterAll` to prevent resource leaks
4. **Parallel Safety**: Tests run sequentially (`--runInBand`) to avoid race conditions
5. **Timeout Management**: Set appropriate timeouts for blockchain operations
6. **Error Handling**: Use try/finally blocks to ensure cleanup runs even on failures

## Performance Tips

1. **Container Reuse**: Testcontainers reuses containers across test runs (when possible)
2. **Block Caching**: Anvil caches forked blocks for faster subsequent runs
3. **Parallel Services**: MongoDB, Redis, and Anvil start in parallel during setup
4. **CI Caching**: GitHub Actions caches pnpm dependencies for faster builds

## CI/CD Integration

The E2E workflow runs on:
- Push to `main` or `v2` branches
- Pull requests to `main` or `v2` branches

Workflow features:
- ✅ Parallel service startup (MongoDB, Redis, Anvil)
- ✅ Automatic artifact upload (test results, logs)
- ✅ Concurrency control (cancel redundant runs)
- ✅ 30-minute timeout
- ✅ Comprehensive error reporting

## Contract Addresses

You must update `test/config.e2e.yaml` with actual contract addresses deployed on the testnets.

### Where to Find Contract Addresses

1. **Block Explorers**:
   - Base Mainnet: https://sepolia.basescan.org
   - Optimism Mainnet: https://sepolia-optimism.etherscan.io

2. **Deployment Scripts**: Check your deployment records or scripts
3. **Team Documentation**: Ask your team for the latest deployed addresses

### Required Contracts

- `portal` - Intent portal contract
- `provers.hyper` - Hyper prover contract
- `tokens[].address` - ERC20 token contracts

## FAQ

**Q: Can I run E2E tests without Alchemy API keys?**
A: Yes, the tests will use public endpoints, but they have rate limits and may be slower.

**Q: Do I need to deploy contracts before running tests?**
A: No, use existing contracts deployed on Base Mainnet and Optimism Mainnet testnets.

**Q: How do I add a new test?**
A: Create a new `.e2e.spec.ts` file in `test/e2e/` and follow the test template.

**Q: Can I run a single E2E test?**
A: Yes: `pnpm test:e2e -- test/e2e/app.e2e.spec.ts`

**Q: How do I debug Anvil issues?**
A: Check Anvil logs in `anvil-base.log` and `anvil-op.log` (created by the test runner).

**Q: Why do tests run sequentially?**
A: E2E tests use shared resources (Anvil, MongoDB) and must run one at a time to avoid conflicts.

## Support

For issues or questions:
1. Check this documentation
2. Review existing E2E tests for examples
3. Check GitHub Actions logs for CI failures
4. Contact the development team

## References

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testcontainers](https://testcontainers.com/)
- [Foundry Anvil](https://book.getfoundry.sh/anvil/)
- [Viem Documentation](https://viem.sh/)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
