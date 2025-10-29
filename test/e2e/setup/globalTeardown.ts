import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { AnvilManager, getDefaultAnvilConfigs } from './anvil-manager';
import { TestContainersManager } from './test-containers';

/**
 * Kill all Anvil processes as a safety measure
 */
function forceKillAnvil(): void {
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /F /IM anvil.exe', { stdio: 'ignore' });
    } else {
      execSync('pkill -9 anvil', { stdio: 'ignore' });
    }
    console.log('  ✓ Force-killed all Anvil processes');
  } catch (error) {
    // No processes to kill - this is fine
  }
}

/**
 * Global teardown for E2E tests
 *
 * This function runs once after all tests and:
 * 1. Stops all Anvil instances
 * 2. Force-kills any remaining Anvil processes
 * 3. Stops MongoDB and Redis containers (if running locally)
 * 4. Cleans up temporary files
 */
export default async function globalTeardown(): Promise<void> {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║          E2E Test Environment Teardown                    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Read setup state
    const setupStatePath = path.join(__dirname, '..', '..', '.e2e-setup-state.json');

    if (fs.existsSync(setupStatePath)) {
      const stateContent = fs.readFileSync(setupStatePath, 'utf-8');
      const _setupState = JSON.parse(stateContent);
    }

    // Note: SharedAppManager handles app cleanup automatically via exit handlers
    // No need to explicitly close the app here

    // Stop Anvil instances
    console.log('🧹 Step 1: Stopping Anvil instances...');
    const anvilManager = new AnvilManager(getDefaultAnvilConfigs());
    await anvilManager.stopAll();

    // Force-kill any remaining Anvil processes (safety net)
    forceKillAnvil();

    // Stop containers
    console.log('\n🧹 Step 2: Stopping database containers...');
    const containersManager = new TestContainersManager();
    await containersManager.stop();

    // Clean up setup state file
    console.log('\n🧹 Step 3: Cleaning up temporary files...');
    if (fs.existsSync(setupStatePath)) {
      fs.unlinkSync(setupStatePath);
      console.log('  ✓ Removed setup state file');
    }

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║          E2E Environment Cleaned Up                       ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('\n⚠️  E2E teardown encountered errors:', error);
    // Don't throw - we want teardown to complete even if some steps fail
  }
}
