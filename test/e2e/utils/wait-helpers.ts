import { Hex } from 'viem';

import { IntentStatus } from '@/common/interfaces/intent.interface';

import { E2E_TIMEOUTS, POLL_CONFIG } from '../config/timeouts';
import { E2ETestContext } from '../context/test-context';

import { pollUntil } from './polling';

/**
 * Wait options
 */
export interface WaitOptions {
  timeout?: number;
  interval?: number;
}

/**
 * Wait for an intent to be detected by the solver
 *
 * This function polls MongoDB until the intent appears in the database.
 * Useful for verifying that the solver has detected the IntentPublished event.
 *
 * Now uses exponential backoff for faster and more reliable polling.
 *
 * Usage:
 *   await waitForDetection(intentHash, ctx);
 *   await waitForDetection(intentHash, ctx, { timeout: 20000 });
 *
 * @param intentHash - The intent hash to wait for
 * @param context - E2E test context containing IntentsService
 * @param options - Timeout and polling interval options
 */
export async function waitForDetection(
  intentHash: Hex,
  context: E2ETestContext,
  options: WaitOptions = {},
): Promise<void> {
  const { timeout = E2E_TIMEOUTS.DETECTION, interval = POLL_CONFIG.INITIAL_INTERVAL } = options;

  await pollUntil(
    () => context.intentsService.findById(intentHash),
    (intent) => intent !== null,
    {
      timeout,
      interval,
      intervalMultiplier: POLL_CONFIG.INTERVAL_MULTIPLIER,
      maxInterval: POLL_CONFIG.MAX_INTERVAL,
      timeoutMessage: `Timeout waiting for intent detection after ${timeout}ms: ${intentHash}`,
    },
  );
}

/**
 * Wait for an intent to be fulfilled
 *
 * This function polls MongoDB until the intent status changes to FULFILLED.
 * More reliable than event polling since it doesn't depend on timing of event listeners.
 *
 * Now uses exponential backoff for faster detection and lower database load.
 *
 * Usage:
 *   await waitForFulfillment(intentHash, ctx);
 *   await waitForFulfillment(intentHash, ctx, { timeout: 90000 });
 *
 * @param intentHash - The intent hash to wait for
 * @param context - E2E test context containing IntentsService
 * @param options - Timeout and polling interval options
 */
export async function waitForFulfillment(
  intentHash: Hex,
  context: E2ETestContext,
  options: WaitOptions = {},
): Promise<void> {
  const { timeout = E2E_TIMEOUTS.FULFILLMENT, interval = POLL_CONFIG.INITIAL_INTERVAL } = options;

  await pollUntil(
    () => context.intentsService.findById(intentHash),
    (intent) => intent?.status === IntentStatus.FULFILLED,
    {
      timeout,
      interval,
      intervalMultiplier: POLL_CONFIG.INTERVAL_MULTIPLIER,
      maxInterval: POLL_CONFIG.MAX_INTERVAL,
      timeoutMessage: `Timeout waiting for intent fulfillment after ${timeout}ms: ${intentHash}`,
    },
  );
}

/**
 * Wait and verify an intent is NOT fulfilled
 *
 * This function waits for a specified duration and then verifies that the intent
 * was NOT fulfilled. Useful for testing rejection scenarios (insufficient funding,
 * expired deadlines, invalid provers, etc.).
 *
 * Usage:
 *   await waitForRejection(intentHash, ctx);
 *   await waitForRejection(intentHash, ctx, { timeout: 10000 });
 *
 * @param intentHash - The intent hash to check
 * @param context - E2E test context containing IntentsService
 * @param options - Timeout and polling interval options
 */
export async function waitForRejection(
  intentHash: Hex,
  context: E2ETestContext,
  options: WaitOptions = {},
): Promise<void> {
  const { timeout = E2E_TIMEOUTS.REJECTION } = options;

  // Wait for the specified duration
  await new Promise((resolve) => setTimeout(resolve, timeout));

  // Verify intent was NOT fulfilled
  const intent = await context.intentsService.findById(intentHash);

  if (intent?.status === IntentStatus.FULFILLED) {
    throw new Error(
      `Expected intent to be rejected, but it was fulfilled: ${intentHash}. Status: ${intent.status}`,
    );
  }
}

/**
 * Wait for an intent to reach a specific status
 *
 * Generic wait function that can be used for any status.
 * Now uses exponential backoff for faster and more reliable polling.
 *
 * Usage:
 *   await waitForStatus(intentHash, IntentStatus.FAILED, ctx);
 *   await waitForStatus(intentHash, IntentStatus.PENDING, ctx, { timeout: 10000 });
 *
 * @param intentHash - The intent hash to wait for
 * @param expectedStatus - The status to wait for
 * @param context - E2E test context containing IntentsService
 * @param options - Timeout and polling interval options
 */
export async function waitForStatus(
  intentHash: Hex,
  expectedStatus: IntentStatus,
  context: E2ETestContext,
  options: WaitOptions = {},
): Promise<void> {
  const { timeout = E2E_TIMEOUTS.FULFILLMENT, interval = POLL_CONFIG.INITIAL_INTERVAL } = options;

  await pollUntil(
    () => context.intentsService.findById(intentHash),
    (intent) => intent?.status === expectedStatus,
    {
      timeout,
      interval,
      intervalMultiplier: POLL_CONFIG.INTERVAL_MULTIPLIER,
      maxInterval: POLL_CONFIG.MAX_INTERVAL,
      timeoutMessage: `Timeout waiting for intent to reach status ${expectedStatus} after ${timeout}ms: ${intentHash}`,
    },
  );
}
