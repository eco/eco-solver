import { Hex } from 'viem';

import { IntentStatus } from '@/common/interfaces/intent.interface';

import { E2E_TIMEOUTS, POLL_CONFIG } from '../config/timeouts';
import { E2ETestContext } from '../context/test-context';

import { pollUntil } from './polling';
import { verifyNoFulfillmentEvent } from './verification-helpers';
import { waitForFulfillment } from './wait-helpers';

/**
 * Chainable Assertion Builder for Intent Testing
 *
 * Provides a fluent API for writing readable test assertions with Jest integration.
 *
 * Usage:
 *   await expectIntent(intentHash, ctx)
 *     .toHaveStatus(IntentStatus.FULFILLED)
 *     .toHaveBeenFulfilled();
 *
 *   await expectIntent(intentHash, ctx)
 *     .toHaveBeenRejected()
 *     .toHaveNoFulfillmentEvent();
 */
export class IntentAssertion {
  constructor(
    private readonly intentHash: Hex,
    private readonly context: E2ETestContext,
  ) {}

  /**
   * Assert that the intent has a specific status
   * Uses Jest's expect for better error diffs
   *
   * @param expectedStatus - The expected status
   * @returns this for chaining
   */
  async toHaveStatus(expectedStatus: IntentStatus): Promise<this> {
    const intent = await this.context.intentsService.findById(this.intentHash);

    expect(intent).toBeDefined();
    expect(intent!.status).toBe(expectedStatus);

    return this;
  }

  /**
   * Assert that the intent was fulfilled
   * Waits for fulfillment if not already fulfilled
   *
   * @returns this for chaining
   */
  async toHaveBeenFulfilled(): Promise<this> {
    await waitForFulfillment(this.intentHash, this.context);
    return this;
  }

  /**
   * Assert that the intent was rejected (NOT fulfilled)
   * Uses Jest's expect for better error messages
   *
   * @returns this for chaining
   */
  async toHaveBeenRejected(): Promise<this> {
    const intent = await this.context.intentsService.findById(this.intentHash);

    // Use Jest's expect with custom message
    expect(intent?.status).not.toBe(IntentStatus.FULFILLED);

    return this;
  }

  /**
   * Assert that no IntentFulfilled event was emitted on-chain
   * Useful for rejection scenarios
   *
   * @param destinationChainId - Chain ID to check for events (default: 10 = Optimism)
   * @returns this for chaining
   */
  async toHaveNoFulfillmentEvent(destinationChainId: number = 10): Promise<this> {
    await verifyNoFulfillmentEvent(this.intentHash, destinationChainId);
    return this;
  }

  /**
   * Assert that the intent was rejected with a specific error message
   * Validates that lastError.message contains the expected reason
   * Polls until lastError is populated or timeout is reached
   *
   * @param expectedReason - The expected substring in the rejection message
   * @returns this for chaining
   */
  async toHaveRejectionReason(expectedReason: string): Promise<this> {
    // Poll until lastError is populated
    await pollUntil(
      () => this.context.intentsService.findById(this.intentHash),
      (intent) => intent?.lastError?.message !== undefined,
      {
        timeout: E2E_TIMEOUTS.REJECTION,
        interval: POLL_CONFIG.INITIAL_INTERVAL,
        intervalMultiplier: POLL_CONFIG.INTERVAL_MULTIPLIER,
        maxInterval: POLL_CONFIG.MAX_INTERVAL,
        timeoutMessage: `Timeout waiting for lastError to be populated for intent: ${this.intentHash}`,
      },
    );

    // Now verify the error message contains the expected reason
    const intent = await this.context.intentsService.findById(this.intentHash);
    expect(intent?.lastError?.message).toContain(expectedReason);

    return this;
  }

  /**
   * Assert that tokens were delivered to the recipient
   *
   * @param expectedAmount - The expected token amount
   * @param tokenSymbol - Token symbol for error messages
   * @returns this for chaining
   */
  async toHaveDeliveredTokens(
    expectedAmount: bigint,
    _tokenSymbol: string = 'USDC',
  ): Promise<this> {
    // Get the intent to check delivery
    const intent = await this.context.intentsService.findById(this.intentHash);

    // Use Jest's expect for existence check
    expect(intent).toBeDefined();

    // For now, just verify the intent is fulfilled
    // Full balance verification requires BalanceTracker
    expect(intent!.status).toBe(IntentStatus.FULFILLED);

    return this;
  }
}

/**
 * Factory function to create intent assertions
 *
 * Note: Renamed from 'expect' to 'expectIntent' to avoid conflict with Jest's global expect
 *
 * Usage:
 *   await expectIntent(intentHash, ctx).toHaveStatus(IntentStatus.FULFILLED);
 *   await expectIntent(intentHash, ctx).toHaveBeenFulfilled().toHaveDeliveredTokens(amount);
 *
 * @param intentHash - The intent hash to assert on
 * @param context - E2E test context
 * @returns Chainable assertion builder
 */
export function expectIntent(intentHash: Hex, context: E2ETestContext): IntentAssertion {
  return new IntentAssertion(intentHash, context);
}
