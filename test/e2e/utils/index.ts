/**
 * E2E Testing Framework
 *
 * Production-ready utilities for writing clean, maintainable E2E tests.
 *
 * Usage:
 *   import {
 *     setupTestContext,
 *     publishIntent,
 *     waitForFulfillment,
 *     expect,
 *     E2E_TIMEOUTS,
 *   } from './utils';
 *
 *   let ctx: E2ETestContext;
 *
 *   beforeAll(async () => {
 *     ctx = await setupTestContext();
 *   }, E2E_TIMEOUTS.BEFORE_ALL);
 *
 *   it('test', async () => {
 *     await expect(intentHash, ctx).toHaveBeenFulfilled();
 *   });
 */

// Test context (replaces global state pattern)
export { E2ETestContext, setupTestContext } from '../context/test-context';

// Timeout configuration
export { E2E_TIMEOUTS, POLL_CONFIG } from '../config/timeouts';

// Intent publishing
export {
  publishIntent,
  type PublishIntentOptions,
  type PublishIntentResult,
} from './intent-publisher';

// Balance tracking
export { BalanceTracker } from './balance-tracker';

// Wait helpers (now require context parameter)
export {
  waitForDetection,
  waitForFulfillment,
  waitForRejection,
  waitForStatus,
  type WaitOptions,
} from './wait-helpers';

// Verification helpers (now require context parameter)
export {
  verifyIntentStatus,
  verifyNoFulfillmentEvent,
  verifyNotFulfilled,
  verifyTokensDelivered,
} from './verification-helpers';

// Simple assertions (now require context parameter)
export {
  expectBalanceIncreased,
  expectDefined,
  expectIntentFulfilled,
  expectIntentNotFulfilled,
  expectIntentStatus,
  expectTransactionSuccess,
} from './assertions';

// Chainable assertion builder (renamed to avoid conflict with Jest's expect)
export { expectIntent, IntentAssertion } from './assertion-builder';

// Polling utilities
export {
  createPoller,
  type PollOptions,
  pollUntil,
  pollUntilChanged,
  pollUntilDefined,
  pollUntilTrue,
} from './polling';
