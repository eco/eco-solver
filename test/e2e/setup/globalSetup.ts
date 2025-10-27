import * as fs from 'fs';
import * as path from 'path';

import { AnvilManager, getDefaultAnvilConfigs } from './anvil-manager';
import { TestContainersManager } from './test-containers';
import { waitForAllServices } from './waitFor';

/**
 * Global setup for E2E tests
 *
 * This function runs once before all tests and:
 * 1. Starts MongoDB and Redis (via Testcontainers locally, or uses CI services)
 * 2. Starts two Anvil fork instances (Base Sepolia and Optimism Sepolia)
 * 3. Updates the config.e2e.yaml with dynamic connection details
 * 4. Waits for all services to be ready
 *
 * The setup state is saved to a temporary file so teardown can clean up properly.
 */
export default async function globalSetup(): Promise<void> {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║          E2E Test Environment Setup                       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Note: Anvil manager automatically cleans up ports before starting
    // Initialize managers
    const containersManager = new TestContainersManager();
    const anvilManager = new AnvilManager(getDefaultAnvilConfigs());

    // Start containers (MongoDB + Redis)
    console.log('📦 Step 1: Starting database containers...');
    const containerConfig = await containersManager.start();

    // Start Anvil instances
    console.log('\n📦 Step 2: Starting Anvil blockchain forks...');
    await anvilManager.startAll();

    // Wait for blockchain services to be ready
    // Note: MongoDB and Redis are already verified by Testcontainers health checks
    console.log('\n📦 Step 3: Verifying blockchain readiness...');
    await waitForAllServices({
      mongoUri: containerConfig.mongoUri,
      redisHost: containerConfig.redisHost,
      redisPort: containerConfig.redisPort,
      anvilInstances: [
        { name: 'Base Sepolia', url: 'http://localhost:8545' },
        { name: 'Optimism Sepolia', url: 'http://localhost:9545' },
      ],
      skipDbChecks: true, // Trust Testcontainers health checks
    });

    // Set environment variables for dynamic connection details
    // These will override the config.e2e.yaml values
    console.log('\n📦 Step 4: Setting environment variables...');
    process.env.MONGODB_URI = containerConfig.mongoUri;
    process.env.REDIS_HOST = containerConfig.redisHost;
    process.env.REDIS_PORT = containerConfig.redisPort.toString();
    console.log('  ✓ Environment variables set');

    // Save setup state for teardown
    const setupState = {
      isCI: containersManager.isRunningInCI(),
      mongoUri: containerConfig.mongoUri,
      redisHost: containerConfig.redisHost,
      redisPort: containerConfig.redisPort,
      timestamp: Date.now(),
    };

    const setupStatePath = path.join(__dirname, '..', '..', '.e2e-setup-state.json');
    fs.writeFileSync(setupStatePath, JSON.stringify(setupState, null, 2));

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║          E2E Environment Ready                            ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('Services:');
    console.log(`  MongoDB:   ${containerConfig.mongoUri}`);
    console.log(`  Redis:     ${containerConfig.redisHost}:${containerConfig.redisPort}`);
    console.log(`  Base RPC:  http://localhost:8545 (Chain ID: 84532)`);
    console.log(`  OP RPC:    http://localhost:9545 (Chain ID: 11155420)`);
    console.log('\n  Environment variables set for NestJS app to use dynamic ports');
    console.log('');
  } catch (error) {
    console.error('\n❌ E2E setup failed:', error);
    throw error;
  }
}
