/**
 * Centralized Timeout Configuration for E2E Tests
 *
 * All timing values in one place for easy tuning between local and CI environments.
 * Values are in milliseconds.
 */

export const E2E_TIMEOUTS = {
  /**
   * How long to wait for an intent to be detected in MongoDB
   * After publishing an intent on-chain, this is how long we poll the database
   */
  DETECTION: 15_000,

  /**
   * How long to wait for cross-chain transfer fulfillment
   * Includes validation, execution, and on-chain confirmation time
   */
  FULFILLMENT: 60_000,

  /**
   * How long to wait when verifying an intent is NOT fulfilled
   * Used for rejection scenarios (insufficient funding, expired deadlines, etc.)
   */
  REJECTION: 8_000,

  /**
   * How long to wait for the NestJS app to become ready
   * Polls the /health/live endpoint until it returns 200
   */
  APP_READY: 30_000,

  /**
   * Timeout for Jest beforeAll hooks
   * Should be longer than APP_READY + funding time
   */
  BEFORE_ALL: 120_000,

  /**
   * Timeout for Jest afterAll hooks
   * Time needed to gracefully close the app
   */
  AFTER_ALL: 60_000,

  /**
   * Timeout for individual test cases
   * Should be longer than FULFILLMENT timeout
   */
  TEST_CASE: 90_000,
} as const;

export const POLL_CONFIG = {
  /**
   * Initial polling interval (grows with exponential backoff)
   */
  INITIAL_INTERVAL: 100,

  /**
   * Exponential backoff multiplier
   * Each poll increases interval by this factor
   */
  INTERVAL_MULTIPLIER: 1.5,

  /**
   * Maximum polling interval (caps exponential growth)
   */
  MAX_INTERVAL: 2_000,
} as const;
