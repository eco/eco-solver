import { ChildProcess, execSync, spawn } from 'child_process';

/**
 * Configuration for an Anvil instance
 */
export interface AnvilConfig {
  name: string; // Human-readable name (e.g., "Base Mainnet")
  port: number; // Port to run Anvil on
  forkUrl: string; // RPC URL to fork from
  forkBlockNumber?: number; // Optional: specific block to fork from
  chainId?: number; // Optional: override chain ID
}

/**
 * Kill any process using the specified port
 */
function killProcessOnPort(port: number): void {
  try {
    // Try to find and kill process on the port
    const command =
      process.platform === 'win32' ? `netstat -ano | findstr :${port}` : `lsof -ti:${port}`;

    const result = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });

    if (result.trim()) {
      if (process.platform === 'win32') {
        // Windows: extract PID and kill
        const lines = result.split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid) {
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          }
        }
      } else {
        // Unix: kill directly
        execSync(`kill -9 ${result.trim()}`, { stdio: 'ignore' });
      }
      console.log(`    Cleaned up process on port ${port}`);
    }
  } catch (error) {
    // No process found or already cleaned - this is fine
  }
}

/**
 * Kill all anvil processes system-wide
 */
function killAllAnvilProcesses(): void {
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /F /IM anvil.exe', { stdio: 'ignore' });
    } else {
      execSync('pkill -9 anvil', { stdio: 'ignore' });
    }
    console.log('    Killed all Anvil processes');
  } catch (error) {
    // No anvil processes found - this is fine
  }
}

/**
 * Manages Anvil blockchain fork instances for E2E testing
 *
 * Usage:
 *   const manager = new AnvilManager([config1, config2]);
 *   await manager.startAll();
 *   // ... run tests ...
 *   await manager.stopAll();
 */
export class AnvilManager {
  private processes: Map<string, ChildProcess> = new Map();
  private configs: AnvilConfig[];

  constructor(configs: AnvilConfig[]) {
    this.configs = configs;
  }

  /**
   * Start all Anvil instances
   */
  async startAll(): Promise<void> {
    console.log('🔨 Starting Anvil fork instances...');

    // Clean up any existing processes on the ports first
    console.log('  Cleaning up existing processes...');
    killAllAnvilProcesses(); // Kill all anvil processes system-wide
    this.configs.forEach((config) => killProcessOnPort(config.port)); // Extra safety for specific ports

    // Wait a moment for cleanup to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Start all Anvil instances in parallel
    await Promise.all(this.configs.map((config) => this.start(config)));

    console.log('✅ All Anvil instances started successfully');
  }

  /**
   * Start a single Anvil instance
   */
  private async start(config: AnvilConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`  Starting ${config.name} fork on port ${config.port}...`);

      // Build Anvil command arguments
      const args = [
        '--port',
        config.port.toString(),
        '--fork-url',
        config.forkUrl,
        '--host',
        '0.0.0.0', // Allow connections from any host (needed for Docker)
        '--no-rate-limit', // Disable rate limiting for tests
      ];

      // Add optional fork block number
      if (config.forkBlockNumber) {
        args.push('--fork-block-number', config.forkBlockNumber.toString());
      }

      // Add optional chain ID override
      if (config.chainId) {
        args.push('--chain-id', config.chainId.toString());
      }

      // Spawn Anvil process
      const process = spawn('anvil', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      // Handle process errors
      process.on('error', (error) => {
        console.error(`❌ Failed to start ${config.name}:`, error.message);
        reject(new Error(`Failed to start Anvil for ${config.name}: ${error.message}`));
      });

      // Capture stderr for error reporting
      let stderr = '';
      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Wait for Anvil to be ready
      let output = '';
      const readyTimeout = setTimeout(() => {
        process.kill();
        reject(
          new Error(
            `Timeout waiting for ${config.name} to start. Output: ${output}\nErrors: ${stderr}`,
          ),
        );
      }, 30000); // 30 second timeout

      process.stdout?.on('data', (data) => {
        output += data.toString();

        // Anvil prints "Listening on 0.0.0.0:PORT" when ready
        if (output.includes('Listening on')) {
          clearTimeout(readyTimeout);
          this.processes.set(config.name, process);
          console.log(`    ✓ ${config.name} ready on http://localhost:${config.port}`);
          resolve();
        }
      });

      // Handle process exit
      process.on('exit', (code, _signal) => {
        if (code !== 0 && code !== null) {
          console.error(`❌ ${config.name} exited with code ${code}`);
          if (stderr) {
            console.error(`   Errors: ${stderr}`);
          }
        }
        this.processes.delete(config.name);
      });
    });
  }

  /**
   * Stop all Anvil instances
   */
  async stopAll(): Promise<void> {
    console.log('🛑 Stopping Anvil instances...');

    const stopPromises = Array.from(this.processes.entries()).map(([name, process]) => {
      return new Promise<void>((resolve) => {
        console.log(`  Stopping ${name}...`);

        // Kill process
        process.kill('SIGTERM');

        // Wait for process to exit or force kill after 5 seconds
        const forceKillTimeout = setTimeout(() => {
          if (!process.killed) {
            console.warn(`    ⚠ Force killing ${name}...`);
            process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        process.once('exit', () => {
          clearTimeout(forceKillTimeout);
          console.log(`    ✓ ${name} stopped`);
          resolve();
        });
      });
    });

    await Promise.all(stopPromises);
    this.processes.clear();

    console.log('✅ All Anvil instances stopped');
  }

  /**
   * Check if a specific Anvil instance is running
   */
  isRunning(name: string): boolean {
    const process = this.processes.get(name);
    return process !== undefined && !process.killed;
  }

  /**
   * Get RPC URL for a specific Anvil instance
   */
  getRpcUrl(name: string): string | undefined {
    const config = this.configs.find((c) => c.name === name);
    return config ? `http://localhost:${config.port}` : undefined;
  }
}

/**
 * Get default Anvil configurations for E2E tests
 * Uses environment variables for fork URLs or defaults to free public endpoints
 */
export function getDefaultAnvilConfigs(): AnvilConfig[] {
  // Get fork URLs from environment or use free alternatives
  // Priority order:
  // 1. BASE_MAINNET_RPC_URL / OP_MAINNET_RPC_URL (from secrets/env)
  // 2. Free public endpoints (rate limited but work for basic tests)

  const baseForkUrl = process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org'; // Free public Base mainnet RPC

  const opForkUrl = process.env.OP_MAINNET_RPC_URL || 'https://mainnet.optimism.io'; // Free public Optimism mainnet RPC

  return [
    {
      name: 'Base Mainnet',
      port: 8545,
      forkUrl: baseForkUrl,
      chainId: 8453, // Base mainnet chain ID
    },
    {
      name: 'Optimism Mainnet',
      port: 9545,
      forkUrl: opForkUrl,
      chainId: 10, // Optimism mainnet chain ID
    },
  ];
}
