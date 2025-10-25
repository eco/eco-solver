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

---

## 🔧 Alternative: One-Command Test Runner

Use the automated test runner script:

```bash
# Start services, run tests, optionally cleanup
pnpm test:e2e:services
```

This script will:
1. ✅ Start all services automatically
2. ✅ Wait for services to be ready
3. ✅ Run E2E tests
4. ✅ Ask if you want to stop services

---

## 🆘 If You Hit Port Conflicts

If you see **"Address already in use (os error 48)"**:

```bash
# Run cleanup script (fixes 99% of issues)
pnpm test:e2e:cleanup

# Then try again
docker-compose -f docker-compose.e2e.yml up -d
pnpm test:e2e
```

**Why this happens**: Anvil processes from previous runs didn't exit cleanly.

**What cleanup does**: Kills all Anvil processes, frees ports, removes containers.

---

## ✅ Environment Check (Optional)

Run the preflight check to verify all prerequisites:

```bash
pnpm test:e2e:check
```

This verifies:
- ✅ Node.js 20+
- ✅ pnpm installed
- ✅ Docker running
- ✅ Foundry/Anvil installed
- ✅ Configuration files exist
- ✅ Dependencies installed

## 📋 Prerequisites Checklist

Before running tests, ensure you have:

- [ ] **Node.js 20+** installed
- [ ] **pnpm** installed (`npm install -g pnpm`)
- [ ] **Docker** running (Docker Desktop on macOS/Windows)
- [ ] **Foundry** installed:
  ```bash
  curl -L https://foundry.paradigm.xyz | bash
  foundryup
  ```
- [ ] **Dependencies** installed (`pnpm install`)
- [ ] **Contract addresses** updated in `test/config.e2e.yaml`

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

### Port Already in Use ⚠️ (Most Common Issue)
If you see "Address already in use (os error 48)", run the cleanup script:

```bash
# Quick fix - cleanup all E2E resources
pnpm test:e2e:cleanup

# Then run tests again
pnpm test:e2e:services
```

**Why this happens**: Anvil processes from previous test runs may not have been killed properly.

**What the cleanup does**:
- Kills all Anvil processes
- Frees up ports 8545 and 9545
- Stops Docker containers
- Removes temporary files

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

## 🎯 Next Steps

1. **Update contract addresses** in `test/config.e2e.yaml`
2. **Run preflight check**: `pnpm test:e2e:check`
3. **Fix any issues** identified by the check
4. **Run tests**: `pnpm test:e2e`
5. **Write your own tests** following the examples in `test/e2e/app.e2e.spec.ts`

## 💡 Tips

- Run preflight check first: `pnpm test:e2e:check`
- Tests run sequentially to avoid conflicts
- Each test file gets a fresh app instance
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
