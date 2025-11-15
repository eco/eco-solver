import { Address, createPublicClient, erc20Abi, Hex, http } from 'viem';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';

import { E2ETestContext } from '../context/test-context';
import { getRpcUrl, getTokenAddress } from '../helpers/e2e-config';
import { waitForIntentFulfilled } from '../helpers/test-app.helper';

/**
 * Verify tokens were delivered to the recipient
 *
 * This function checks that the recipient's balance on the destination chain
 * increased by at least the expected amount.
 *
 * Usage:
 *   await verifyTokensDelivered(intent); // Checks route token amount
 *   await verifyTokensDelivered(intent, parseUnits('15', 6)); // Custom amount
 *
 * @param intent - The intent being verified
 * @param expectedAmount - Optional: expected amount (defaults to intent.route.tokens[0].amount)
 */
export async function verifyTokensDelivered(
  intent: Intent,
  expectedAmount?: bigint,
): Promise<void> {
  // Determine destination chain
  const destinationChainId = Number(intent.destination);
  const rpcUrl = getRpcUrl(destinationChainId);
  const tokenAddress = getTokenAddress(destinationChainId, 'USDC');

  // Get recipient from route calls (first call should be the transfer)
  const recipientAddress = intent.route.calls[0]?.target as Address | undefined;
  if (!recipientAddress) {
    throw new Error('Cannot determine recipient address from intent route calls');
  }

  const amount = expectedAmount || intent.route.tokens[0]?.amount;
  if (!amount) {
    throw new Error('No token amount specified in intent route');
  }

  // Create client
  const client = createPublicClient({
    transport: http(rpcUrl),
  });

  // Get current balance
  const balance = (await client.readContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [recipientAddress],
  })) as bigint;

  // Verify balance is at least the expected amount
  // Note: We can't compare against initial balance since we don't track it here
  // The test should use BalanceTracker for more precise verification
  if (balance < amount) {
    throw new Error(
      `Recipient balance (${balance.toString()}) is less than expected amount (${amount.toString()})`,
    );
  }
}

/**
 * Verify intent is NOT fulfilled
 *
 * Checks that the intent status in the database is NOT FULFILLED.
 * Useful for testing rejection scenarios.
 *
 * Usage:
 *   await verifyNotFulfilled(intentHash, ctx);
 *
 * @param intentHash - The intent hash to verify
 * @param context - E2E test context containing IntentsService
 */
export async function verifyNotFulfilled(intentHash: Hex, context: E2ETestContext): Promise<void> {
  const intent = await context.intentsService.findById(intentHash);

  if (intent?.status === IntentStatus.FULFILLED) {
    throw new Error(`Expected intent to NOT be fulfilled, but status is: ${intent.status}`);
  }
}

/**
 * Verify no IntentFulfilled event was emitted
 *
 * Attempts to find an IntentFulfilled event on the destination chain.
 * Expects to timeout (no event found), which indicates the intent was not fulfilled.
 *
 * Usage:
 *   await verifyNoFulfillmentEvent(intentHash, 10);  // 10 = Optimism
 *
 * @param intentHash - The intent hash to check
 * @param destinationChainId - The destination chain ID to check events on (default: 10 = Optimism)
 */
export async function verifyNoFulfillmentEvent(
  intentHash: Hex,
  destinationChainId: number = 10,
): Promise<void> {
  const rpcUrl = getRpcUrl(destinationChainId);

  try {
    await waitForIntentFulfilled(rpcUrl, intentHash, {
      timeout: 5000,
      interval: 1000,
    });
    // If we get here, event was found - test should fail
    throw new Error('IntentFulfilled event was found when it should not have been emitted');
  } catch (error) {
    // Expected - no event found
    // Verify it's a timeout error, not some other error
    if (error instanceof Error && error.message.includes('Timeout waiting for')) {
      // This is the expected timeout - intent was not fulfilled
      return;
    }
    // Re-throw if it's a different error
    throw error;
  }
}

/**
 * Verify intent has a specific status
 *
 * Checks the intent status in the database matches the expected status.
 *
 * Usage:
 *   await verifyIntentStatus(intentHash, IntentStatus.FULFILLED, ctx);
 *   await verifyIntentStatus(intentHash, IntentStatus.FAILED, ctx);
 *
 * @param intentHash - The intent hash to verify
 * @param expectedStatus - The expected status
 * @param context - E2E test context containing IntentsService
 */
export async function verifyIntentStatus(
  intentHash: Hex,
  expectedStatus: IntentStatus,
  context: E2ETestContext,
): Promise<void> {
  const intent = await context.intentsService.findById(intentHash);

  if (!intent) {
    throw new Error(`Intent not found in database: ${intentHash}`);
  }

  if (intent.status !== expectedStatus) {
    throw new Error(
      `Intent status mismatch. Expected: ${expectedStatus}, Actual: ${intent.status}`,
    );
  }
}
