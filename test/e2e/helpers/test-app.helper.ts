import { createPublicClient, Hex, http } from 'viem';

import { portalAbi } from '@/common/abis/portal.abi';

import { getPortalAddress } from './e2e-config';

/**
 * Wait for the app to be ready
 * Polls the readiness endpoint which verifies MongoDB and Redis connections
 * This ensures critical dependencies are initialized before tests start
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
  const healthUrl = `${baseUrl}/health/ready`;

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
 * Chain ID constants for test readability
 */
export const BASE_MAINNET_CHAIN_ID = 8453;
export const OPTIMISM_MAINNET_CHAIN_ID = 10;

/**
 * Test chain IDs
 */
export const TEST_CHAIN_IDS = {
  BASE_MAINNET: BASE_MAINNET_CHAIN_ID,
  OPTIMISM_MAINNET: OPTIMISM_MAINNET_CHAIN_ID,
} as const;

/**
 * Test RPC URLs
 */
export const TEST_RPC = {
  BASE_MAINNET: 'http://localhost:8545',
  OPTIMISM_MAINNET: 'http://localhost:9545',
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

  // Determine chain ID from RPC URL
  const chainId = await publicClient.getChainId();
  const portalAddress = getPortalAddress(chainId);

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
      const events = await publicClient.getContractEvents({
        address: portalAddress as `0x${string}`,
        abi: portalAbi,
        eventName,
        fromBlock: startBlock,
        toBlock: currentBlock,
        strict: true,
      });

      // Find the first matching event
      const matchedEvent = events.find(filter);
      if (matchedEvent) {
        console.log(`Found ${eventName} event:`, matchedEvent);
        return matchedEvent;
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
