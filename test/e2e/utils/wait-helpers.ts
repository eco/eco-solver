import { Hex } from 'viem';

import { IntentStatus } from '@/common/interfaces/intent.interface';
import { IntentsService } from '@/modules/intents/intents.service';

/**
 * Wait options
 */
export interface WaitOptions {
  timeout?: number;
  interval?: number;
}

/**
 * Global IntentsService reference for wait helpers
 * This is set by the test suite during initialization
 */
let globalIntentsService: IntentsService | null = null;

/**
 * Initialize the wait helpers with IntentsService
 * Call this in the test suite's beforeAll hook
 *
 * Usage:
 *   beforeAll(async () => {
 *     app = await createTestAppWithServer();
 *     initializeWaitHelpers(app.get(IntentsService));
 *   });
 */
export function initializeWaitHelpers(intentsService: IntentsService): void {
  globalIntentsService = intentsService;
}

/**
 * Get the IntentsService instance
 */
function getIntentsService(): IntentsService {
  if (!globalIntentsService) {
    throw new Error(
      'IntentsService not initialized. Call initializeWaitHelpers() in beforeAll() hook.',
    );
  }
  return globalIntentsService;
}

/**
 * Wait for an intent to be detected by the solver
 *
 * This function polls MongoDB until the intent appears in the database.
 * Useful for verifying that the solver has detected the IntentPublished event.
 *
 * Usage:
 *   await waitForDetection(intentHash);
 *
 * @param intentHash - The intent hash to wait for
 * @param options - Timeout and polling interval options
 */
export async function waitForDetection(intentHash: Hex, options: WaitOptions = {}): Promise<void> {
  const { timeout = 15000, interval = 1000 } = options;
  const intentsService = getIntentsService();

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const intent = await intentsService.findById(intentHash);
    if (intent) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for intent detection after ${timeout}ms: ${intentHash}`);
}

/**
 * Wait for an intent to be fulfilled
 *
 * This function polls MongoDB until the intent status changes to FULFILLED.
 * More reliable than event polling since it doesn't depend on timing of event listeners.
 *
 * Usage:
 *   await waitForFulfillment(intentHash); // 120s timeout
 *   await waitForFulfillment(intentHash, { timeout: 60000 }); // 60s timeout
 *
 * @param intentHash - The intent hash to wait for
 * @param options - Timeout and polling interval options
 */
export async function waitForFulfillment(
  intentHash: Hex,
  options: WaitOptions = {},
): Promise<void> {
  const { timeout = 120000, interval = 2000 } = options;
  const intentsService = getIntentsService();

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const intent = await intentsService.findById(intentHash);
    if (intent?.status === IntentStatus.FULFILLED) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for intent fulfillment after ${timeout}ms: ${intentHash}`);
}

/**
 * Wait and verify an intent is NOT fulfilled
 *
 * This function waits for a specified duration and then verifies that the intent
 * was NOT fulfilled. Useful for testing rejection scenarios (insufficient funding,
 * expired deadlines, invalid provers, etc.).
 *
 * Usage:
 *   await waitForRejection(intentHash); // Wait 8s and verify NOT fulfilled
 *   await waitForRejection(intentHash, { timeout: 10000 }); // Wait 10s
 *
 * @param intentHash - The intent hash to check
 * @param options - Timeout and polling interval options (default: 8000ms)
 */
export async function waitForRejection(intentHash: Hex, options: WaitOptions = {}): Promise<void> {
  const { timeout = 8000 } = options;

  // Wait for the specified duration
  await new Promise((resolve) => setTimeout(resolve, timeout));

  // Verify intent was NOT fulfilled
  const intentsService = getIntentsService();
  const intent = await intentsService.findById(intentHash);

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
 *
 * Usage:
 *   await waitForStatus(intentHash, IntentStatus.FAILED);
 *   await waitForStatus(intentHash, IntentStatus.PENDING, { timeout: 10000 });
 *
 * @param intentHash - The intent hash to wait for
 * @param expectedStatus - The status to wait for
 * @param options - Timeout and polling interval options
 */
export async function waitForStatus(
  intentHash: Hex,
  expectedStatus: IntentStatus,
  options: WaitOptions = {},
): Promise<void> {
  const { timeout = 120000, interval = 2000 } = options;
  const intentsService = getIntentsService();

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const intent = await intentsService.findById(intentHash);
    if (intent?.status === expectedStatus) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(
    `Timeout waiting for intent to reach status ${expectedStatus} after ${timeout}ms: ${intentHash}`,
  );
}
