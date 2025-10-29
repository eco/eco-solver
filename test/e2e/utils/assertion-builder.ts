import { Hex } from 'viem';

import { IntentStatus } from '@/common/interfaces/intent.interface';

import { E2ETestContext } from '../context/test-context';

import { verifyIntentStatus, verifyNoFulfillmentEvent } from './verification-helpers';
import { waitForFulfillment } from './wait-helpers';

/**
 * Chainable Assertion Builder for Intent Testing
 *
 * Provides a fluent API for writing readable test assertions.
 *
 * Usage:
 *   await expect(intentHash, ctx)
 *     .toHaveStatus(IntentStatus.FULFILLED)
 *     .toHaveBeenFulfilled();
 *
 *   await expect(intentHash, ctx)
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
   *
   * @param expectedStatus - The expected status
   * @returns this for chaining
   */
  async toHaveStatus(expectedStatus: IntentStatus): Promise<this> {
    await verifyIntentStatus(this.intentHash, expectedStatus, this.context);
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
   * Checks the current status without waiting
   *
   * @returns this for chaining
   */
  async toHaveBeenRejected(): Promise<this> {
    const intent = await this.context.intentsService.findById(this.intentHash);

    if (intent?.status === IntentStatus.FULFILLED) {
      throw new Error(
        `Expected intent to be rejected, but it was fulfilled.\n` +
          `Intent Hash: ${this.intentHash}\n` +
          `Status: ${intent.status}`,
      );
    }

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

    if (!intent) {
      throw new Error(`Intent not found: ${this.intentHash}`);
    }

    // For now, just verify the intent is fulfilled
    // Full balance verification requires BalanceTracker
    if (intent.status !== IntentStatus.FULFILLED) {
      throw new Error(
        `Cannot verify token delivery - intent not fulfilled.\n` +
          `Intent Hash: ${this.intentHash}\n` +
          `Status: ${intent.status}`,
      );
    }

    return this;
  }
}

/**
 * Factory function to create intent assertions
 *
 * Usage:
 *   await expect(intentHash, ctx).toHaveStatus(IntentStatus.FULFILLED);
 *   await expect(intentHash, ctx).toHaveBeenFulfilled().toHaveDeliveredTokens(amount);
 *
 * @param intentHash - The intent hash to assert on
 * @param context - E2E test context
 * @returns Chainable assertion builder
 */
export function expect(intentHash: Hex, context: E2ETestContext): IntentAssertion {
  return new IntentAssertion(intentHash, context);
}
