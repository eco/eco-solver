# E2E Tests Quick Start

## ✅ What's Been Set Up

All E2E test infrastructure has been created and configured:

- ✅ Test orchestration (globalSetup/globalTeardown)
- ✅ Anvil manager for blockchain forks
- ✅ Testcontainers for MongoDB/Redis
- ✅ Health check utilities
- ✅ NestJS app test helpers
- ✅ Example E2E test suite
- ✅ Jest configuration
- ✅ GitHub Actions workflow
- ✅ Documentation

## 🚀 Getting Started (Simple 3-Step Process)

### Step 1: Install Dependencies

```bash
pnpm install
```

### Step 2: Update Contract Addresses

**IMPORTANT**: Edit `test/config.e2e.yaml` and replace placeholder contract addresses with your actual deployed contracts on Base Mainnet and Optimism Mainnet.

Look for these lines and replace the addresses:

```yaml
contracts:
  portal: "0x0000000000000000000000000000000000000000"  # TODO: Replace
```

### Step 3: Run Tests with Docker Compose

```bash
# Start all services (MongoDB, Redis, Anvil forks)
docker-compose -f docker-compose.e2e.yml up -d

# Run tests (use compose-specific command)
pnpm test:e2e

# Stop services when done
docker-compose -f docker-compose.e2e.yml down
```

**That's it!** 🎉

**Important**: Use `pnpm test:e2e` (not `test:e2e`) when using Docker Compose to skip the globalSetup container management.

## 🔧 What Happens When You Run Tests

1. **Global Setup** (automatic):
   - Starts MongoDB container (Testcontainers)
   - Starts Redis container (Testcontainers)
   - Launches Anvil fork of Base Mainnet on port 8545
   - Launches Anvil fork of Optimism Mainnet on port 9545
   - Updates config with dynamic connection details
   - Verifies all services are healthy

2. **Test Execution**:
   - Jest runs all `*.e2e.spec.ts` files
   - Tests use real databases and blockchain forks
   - Full NestJS application is bootstrapped for each test file

3. **Global Teardown** (automatic):
   - Stops Anvil instances
   - Stops Docker containers
   - Cleans up temporary files

## 📁 Configuration Files

### `test/config.e2e.yaml`
- Main configuration for E2E tests
- Uses YAML format (aligns with production config)
- Contains placeholders that are dynamically replaced
- **YOU MUST UPDATE CONTRACT ADDRESSES HERE**

### `test/jest-e2e.json`
- Jest configuration
- Points to globalSetup/globalTeardown
- Configures test environment

## 🐛 Troubleshooting

### Docker Not Running
```bash
# Error: Cannot connect to Docker daemon
# Solution: Start Docker Desktop
```

### Anvil Not Found
```bash
# Error: anvil: command not found
# Solution: Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Tests Timeout
- Increase timeout in test: `beforeAll(async () => { ... }, 120000)`
- Check network connectivity to RPC endpoints
- Use your own Alchemy API key for faster performance

### Manual Port Cleanup
If the cleanup script doesn't work:

```bash
# Kill all Anvil processes
pkill -9 anvil

# Or kill specific ports
lsof -ti:8545,9545 | xargs kill -9

# Check if ports are free
lsof -i :8545
lsof -i :9545
```

## 📚 Documentation

- **Full Setup Guide**: `docs/e2e-setup.md`
- **Test Directory README**: `test/README.md`
- **Project README**: `../README.md`

## 🧪 E2E Testing Utilities

The project includes production-ready testing utilities that make writing E2E tests simple and maintainable.

### Testing Utilities

**Located in** `test/e2e/utils/`:
- **publishIntent()** - Single flexible function for publishing intents
- **BalanceTracker** - Track and verify token balance changes
- **Wait Helpers** - Smart waiting utilities (waitForFulfillment, waitForRejection)
- **Verification Helpers** - Common assertion patterns

### Writing Tests with the Utilities

**Example: Simple fulfillment test**
```typescript
import { publishIntent, waitForFulfillment, verifyIntentStatus, BalanceTracker } from './utils';

it('should fulfill a valid intent', async () => {
  // Track balance
  const balances = new BalanceTracker('optimism', USDC_ADDRESS, RECIPIENT_ADDRESS);
  await balances.snapshot();

  // Publish intent
  const { intentHash } = await publishIntent({
    tokenAmount: parseUnits('10', 6),
    rewardTokenAmount: parseUnits('12', 6),
  });

  // Wait and verify
  await waitForFulfillment(intentHash);
  await balances.verifyIncreased(parseUnits('10', 6));
  await verifyIntentStatus(intentHash, IntentStatus.FULFILLED);
});
```

**Example: Rejection test**
```typescript
it('should reject insufficient funding', async () => {
  const { intentHash } = await publishIntent({
    fundingOptions: {
      allowPartial: true,
      approveAmount: parseUnits('6', 6), // Only 50%
    },
  });

  await waitForRejection(intentHash);
  await verifyNotFulfilled(intentHash);
});
```

### Benefits

- **75% less boilerplate** - Tests are 15-25 lines instead of 100+
- **Test logic stays visible** - Everything in `it` blocks
- **Easy to extend** - Just add options to `publishIntent()`
- **Type-safe** - Full IntelliSense support

See `test/e2e/fulfillment-flow.e2e.spec.ts` for complete examples.

## 🎯 Next Steps

1. **Update contract addresses** in `test/config.e2e.yaml`
4. **Run tests**: `pnpm test:e2e`
5. **Write your own tests** using the E2E testing utilities

## 💡 Tips

- Tests run sequentially to avoid conflicts
- Use existing deployed contracts (no deployment needed)
- Check Anvil logs if tests fail: `anvil-base.log`, `anvil-op.log`

## 🚨 Common Mistakes

1. ❌ Forgetting to update contract addresses in `test/config.e2e.yaml`
2. ❌ Running tests without Docker running
3. ❌ Using production environment variables
4. ❌ Not installing Foundry/Anvil

## ✅ Success!

If everything is set up correctly, you should see:

```
╔═══════════════════════════════════════════════════════════╗
║          E2E Test Environment Setup                       ║
╚═══════════════════════════════════════════════════════════╝

📦 Step 1: Starting database containers...
🐳 Starting Docker containers with Testcontainers...
  Starting MongoDB...
    ✓ MongoDB ready on localhost:XXXXX
  Starting Redis...
    ✓ Redis ready on localhost:XXXXX
✅ All containers started successfully

📦 Step 2: Starting Anvil blockchain forks...
🔨 Starting Anvil fork instances...
  Starting Base Mainnet fork on port 8545...
    ✓ Base Mainnet ready on http://localhost:8545
  Starting Optimism Mainnet fork on port 9545...
    ✓ Optimism Mainnet ready on http://localhost:9545
✅ All Anvil instances started successfully

📦 Step 3: Verifying service readiness...
⏳ Waiting for all services to be ready...
  ✓ MongoDB ready
  ✓ Redis ready
  ✓ Base Mainnet ready
  ✓ Optimism Mainnet ready
✅ All services ready

╔═══════════════════════════════════════════════════════════╗
║          E2E Environment Ready                            ║
╚═══════════════════════════════════════════════════════════╝

Running tests...
```

Happy testing! 🎉
