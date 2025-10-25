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
- Run with: `pnpm test:e2e`

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

### Configuration Files

- `config.e2e.yaml` - E2E test configuration (YAML format, aligns with production config)
- `jest-e2e.json` - Jest configuration for E2E tests
- `.e2e-setup-state.json` - Runtime state file (auto-generated, gitignored)

### Test Structure

```
test/
├── e2e/
│   ├── setup/
│   │   ├── globalSetup.ts        # Starts services before all tests
│   │   ├── globalTeardown.ts     # Cleans up after all tests
│   │   ├── anvil-manager.ts      # Manages Anvil blockchain forks
│   │   ├── test-containers.ts    # Manages Docker containers
│   │   └── waitFor.ts            # Health check utilities
│   ├── helpers/
│   │   └── test-app.helper.ts    # NestJS app bootstrap helpers
│   └── *.e2e.spec.ts             # E2E test files
├── config.e2e.yaml               # E2E configuration
├── jest-e2e.json                 # Jest E2E config
└── README.md                     # This file
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
    await app.close();
  });

  it('should test endpoint', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200);
  });
});
```

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
- [E2E Setup Guide](../docs/e2e-setup.md) - Comprehensive setup and troubleshooting
- [Project README](../README.md) - Project overview and architecture

## CI/CD

E2E tests run automatically in GitHub Actions on push/PR. See `.github/workflows/e2e.yml` for the workflow configuration.

Required secrets:
- `ALCHEMY_BASE_SEPOLIA_URL` - Alchemy RPC URL for Base Sepolia fork
- `ALCHEMY_OP_SEPOLIA_URL` - Alchemy RPC URL for Optimism Sepolia fork
