import { Hex } from 'viem';

import { IntentStatus } from '@/common/interfaces/intent.interface';

import { E2ETestContext } from '../context/test-context';

/**
 * Enhanced E2E Test Assertions
 *
 * Provides better error messages and context for test failures.
 * All functions require test context to be passed explicitly.
 */

/**
 * Assert that an intent was fulfilled
 * Provides detailed error message if not fulfilled
 *
 * Usage:
 *   await expectIntentFulfilled(intentHash, ctx);
 */
export async function expectIntentFulfilled(
  intentHash: Hex,
  context: E2ETestContext,
): Promise<void> {
  const intent = await context.intentsService.findById(intentHash);

  if (!intent) {
    throw new Error(
      `Expected intent to be fulfilled, but intent not found in database: ${intentHash}`,
    );
  }

  if (intent.status !== IntentStatus.FULFILLED) {
    const intentData = intent as any;
    throw new Error(
      `Expected intent to be fulfilled, but status is ${intent.status}.\n` +
        `Intent Hash: ${intentHash}\n` +
        `Source Chain: ${intentData.sourceChainId?.toString() || 'N/A'}\n` +
        `Destination Chain: ${intentData.destination?.toString() || 'N/A'}\n` +
        `Vault Address: ${intentData.vaultAddress || 'N/A'}`,
    );
  }
}

/**
 * Assert that an intent was NOT fulfilled
 * Provides detailed error message if it was fulfilled
 *
 * Usage:
 *   await expectIntentNotFulfilled(intentHash, ctx);
 */
export async function expectIntentNotFulfilled(
  intentHash: Hex,
  context: E2ETestContext,
): Promise<void> {
  const intent = await context.intentsService.findById(intentHash);

  if (intent?.status === IntentStatus.FULFILLED) {
    throw new Error(
      `Expected intent NOT to be fulfilled, but it was.\n` +
        `Intent Hash: ${intentHash}\n` +
        `Status: ${intent.status}\n` +
        `This suggests a validation that should have prevented fulfillment did not work correctly.`,
    );
  }
}

/**
 * Assert that an intent has a specific status
 *
 * Usage:
 *   await expectIntentStatus(intentHash, IntentStatus.FAILED, ctx);
 */
export async function expectIntentStatus(
  intentHash: Hex,
  expectedStatus: IntentStatus,
  context: E2ETestContext,
): Promise<void> {
  const intent = await context.intentsService.findById(intentHash);

  if (!intent) {
    throw new Error(
      `Expected intent to have status ${expectedStatus}, but intent not found: ${intentHash}`,
    );
  }

  if (intent.status !== expectedStatus) {
    throw new Error(
      `Expected intent status to be ${expectedStatus}, but got ${intent.status}.\n` +
        `Intent Hash: ${intentHash}`,
    );
  }
}

/**
 * Assert that a balance increased by the expected amount
 */
export function expectBalanceIncreased(
  actual: bigint,
  initial: bigint,
  expected: bigint,
  tokenSymbol: string = 'tokens',
): void {
  const increase = actual - initial;

  if (increase < expected) {
    throw new Error(
      `Expected balance to increase by at least ${expected} ${tokenSymbol}, but only increased by ${increase}.\n` +
        `Initial Balance: ${initial}\n` +
        `Final Balance: ${actual}\n` +
        `Expected Increase: ${expected}\n` +
        `Actual Increase: ${increase}\n` +
        `Shortfall: ${expected - increase}`,
    );
  }
}

/**
 * Assert that a value is defined (not null or undefined)
 */
export function expectDefined<T>(
  value: T | null | undefined,
  name: string = 'Value',
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${name} to be defined, but got ${value}`);
  }
}

/**
 * Assert that a transaction was successful
 */
export function expectTransactionSuccess(
  status: 'success' | 'reverted',
  txHash: Hex,
  chainId?: number,
): void {
  if (status !== 'success') {
    throw new Error(
      `Expected transaction to succeed, but it reverted.\n` +
        `Transaction Hash: ${txHash}` +
        (chainId ? `\nChain ID: ${chainId}` : ''),
    );
  }
}
