import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { createPublicClient, decodeEventLog, Hex, http } from 'viem';

import { AppModule } from '@/app.module';
import { portalAbi } from '@/common/abis/portal.abi';

/**
 * Create and configure a NestJS application for E2E testing
 *
 * This helper function:
 * 1. Creates a NestJS testing module with the full AppModule
 * 2. Applies the same configuration as the production app (validation pipes, etc.)
 * 3. Initializes the app without starting the HTTP server
 *
 * Usage:
 *   let app: INestApplication;
 *
 *   beforeAll(async () => {
 *     app = await createTestApp();
 *   });
 *
 *   afterAll(async () => {
 *     await app.close();
 *   });
 */
export async function createTestApp(): Promise<INestApplication> {
  // Create testing module with full AppModule
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  // Create app instance
  const app = moduleFixture.createNestApplication();

  // Apply same configuration as production app
  // (from src/main.ts)

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable CORS for testing
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Initialize the app (but don't start listening)
  await app.init();

  return app;
}

/**
 * Create and start a NestJS application with HTTP server for E2E testing
 *
 * This helper function creates a full app and starts the HTTP server on the
 * configured port (from config.e2e.yaml - default: 3001).
 *
 * Usage:
 *   let app: INestApplication;
 *   let baseUrl: string;
 *
 *   beforeAll(async () => {
 *     const result = await createTestAppWithServer();
 *     app = result.app;
 *     baseUrl = result.baseUrl;
 *   });
 *
 *   afterAll(async () => {
 *     await app.close();
 *   });
 */
export async function createTestAppWithServer(): Promise<{
  app: INestApplication;
  baseUrl: string;
}> {
  // Create app
  const app = await createTestApp();

  // Get port from config (defaults to 3001 for E2E tests)
  const port = process.env.PORT || 3001;

  // Start listening
  await app.listen(port);

  const baseUrl = `http://localhost:${port}`;

  return { app, baseUrl };
}

/**
 * Wait for the app to be ready
 * Polls the health endpoint until it returns 200
 */
export async function waitForApp(
  baseUrl: string,
  options: {
    timeout?: number;
    interval?: number;
  } = {},
): Promise<void> {
  const { timeout = 30000, interval = 500 } = options;
  const startTime = Date.now();
  const healthUrl = `${baseUrl}/health/live`;

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        return;
      }
    } catch (error) {
      // Not ready yet, continue polling
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for app to be ready at ${baseUrl}`);
}

/**
 * Get a test wallet address
 * These are Anvil's default test accounts
 */
export const TEST_ACCOUNTS = {
  // Account #0 - Used as solver/executor
  ACCOUNT_0: {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  },
  // Account #1 - Can be used as test user
  ACCOUNT_1: {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  },
  // Account #2 - Can be used as another test user
  ACCOUNT_2: {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  },
} as const;

/**
 * Helper to get RPC URLs for forked networks
 */
export const TEST_RPC = {
  BASE_MAINNET: 'http://localhost:8545',
  OPTIMISM_MAINNET: 'http://localhost:9545',
} as const;

/**
 * Helper to get chain IDs
 */
export const TEST_CHAIN_IDS = {
  BASE_MAINNET: 8453,
  OPTIMISM_MAINNET: 10,
} as const;

/**
 * Portal contract addresses (same on both chains in V2)
 */
export const PORTAL_ADDRESS = '0x399Dbd5DF04f83103F77A58cBa2B7c4d3cdede97' as const;

/**
 * USDC token addresses on mainnet forks
 */
export const TOKEN_ADDRESSES = {
  BASE_USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  OPTIMISM_USDC: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
} as const;

/**
 * Prover contract addresses
 */
export const PROVER_ADDRESSES = {
  HYPER: '0x101c1d5521dc32115089d02774F5298Df13dC71f',
  POLYMER: '0xc84beEFFc7A2d9A4a14e257c47a774728c6eDACa',
} as const;

/**
 * Wait for a specific Portal event to be emitted
 *
 * This helper polls the Portal contract for events matching the given criteria.
 * Useful for waiting for IntentPublished, IntentFulfilled, etc.
 *
 * @param rpcUrl - The RPC URL to connect to
 * @param eventName - The event name to watch for (e.g., 'IntentFulfilled')
 * @param filter - Optional filter function to match specific events
 * @param options - Timeout and polling interval options
 * @returns The matched event log
 */
export async function waitForPortalEvent(
  rpcUrl: string,
  eventName: 'IntentPublished' | 'IntentFulfilled' | 'IntentProven' | 'IntentFunded',
  filter: (event: any) => boolean,
  options: {
    timeout?: number;
    interval?: number;
    fromBlock?: bigint;
  } = {},
): Promise<any> {
  const { timeout = 60000, interval = 1000, fromBlock } = options;
  const startTime = Date.now();

  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  });

  // Get the starting block if not provided
  let startBlock = fromBlock;
  if (!startBlock) {
    startBlock = await publicClient.getBlockNumber();
  }

  while (Date.now() - startTime < timeout) {
    try {
      // Get current block
      const currentBlock = await publicClient.getBlockNumber();

      // Fetch logs from start block to current block
      const logs = await publicClient.getLogs({
        address: PORTAL_ADDRESS as `0x${string}`,
        event: {
          type: 'event',
          name: eventName,
          inputs: [],
        },
        fromBlock: startBlock,
        toBlock: currentBlock,
      });

      // Parse logs and find matching event
      for (const log of logs) {
        try {
          const eventAbi = portalAbi.find(
            (item) => item.type === 'event' && item.name === eventName,
          );
          if (!eventAbi) continue;

          const decoded = decodeEventLog({
            abi: [eventAbi],
            data: log.data,
            topics: log.topics,
          });

          const eventData = {
            ...decoded,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
          };

          if (filter(eventData)) {
            console.log(`Found ${eventName} event:`, eventData);
            return eventData;
          }
        } catch (error) {
          // Skip logs that don't match
          continue;
        }
      }

      // Update start block for next iteration to avoid re-processing
      startBlock = currentBlock + 1n;
    } catch (error) {
      console.warn(`Error polling for ${eventName} event:`, error);
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for ${eventName} event after ${timeout}ms`);
}

/**
 * Wait for an intent to be fulfilled on the destination chain
 *
 * Convenience wrapper around waitForPortalEvent for IntentFulfilled events.
 *
 * @param rpcUrl - The RPC URL of the destination chain
 * @param intentHash - The intent hash to wait for
 * @param options - Timeout and polling options
 * @returns The IntentFulfilled event
 */
export async function waitForIntentFulfilled(
  rpcUrl: string,
  intentHash: Hex,
  options?: {
    timeout?: number;
    interval?: number;
    fromBlock?: bigint;
  },
): Promise<any> {
  return waitForPortalEvent(
    rpcUrl,
    'IntentFulfilled',
    (event) => event.args.intentHash === intentHash,
    options,
  );
}
