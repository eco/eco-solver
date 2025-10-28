/**
 * E2E Testing Framework
 *
 * Production-ready utilities for writing clean, maintainable E2E tests.
 *
 * Usage:
 *   import {
 *     publishIntent,
 *     waitForFulfillment,
 *     verifyIntentStatus,
 *     BalanceTracker,
 *     initializeWaitHelpers,
 *     initializeVerificationHelpers,
 *   } from '../framework';
 */

// Intent publishing
export {
  publishIntent,
  type PublishIntentOptions,
  type PublishIntentResult,
} from './intent-publisher';

// Balance tracking
export { BalanceTracker } from './balance-tracker';

// Wait helpers
export {
  initializeWaitHelpers,
  waitForDetection,
  waitForFulfillment,
  waitForRejection,
  waitForStatus,
  type WaitOptions,
} from './wait-helpers';

// Verification helpers
export {
  initializeVerificationHelpers,
  verifyIntentStatus,
  verifyNoFulfillmentEvent,
  verifyNotFulfilled,
  verifyTokensDelivered,
} from './verification-helpers';
