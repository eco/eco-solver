import { Address, parseUnits } from 'viem';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType } from '@/common/utils/chain-type-detector';

import { PublishIntentOptions } from '../utils/intent-publisher';

/**
 * Intent Test Fixtures
 *
 * Pre-configured intent options for common test scenarios.
 * Makes tests more readable and reduces duplication.
 *
 * Usage:
 *   const { intentHash } = await publishIntent(createValidIntentOptions());
 *   const { intentHash } = await publishIntent(createExpiredIntentOptions());
 */

/**
 * Create options for a valid cross-chain intent
 *
 * Default scenario: 10 USDC from Base to Optimism with proper funding
 */
export function createValidIntentOptions(
  overrides: Partial<PublishIntentOptions> = {},
): PublishIntentOptions {
  return {
    tokenAmount: parseUnits('10', 6), // 10 USDC (within 50 USDC limit)
    rewardTokenAmount: parseUnits('12', 6), // 12 USDC reward (covers route + fees)
    ...overrides,
  };
}

/**
 * Create options for an intent with expired deadlines
 *
 * Should be rejected by expiration validation
 */
export function createExpiredIntentOptions(
  overrides: Partial<PublishIntentOptions> = {},
): PublishIntentOptions {
  const expiredTime = BigInt(Math.floor(Date.now() / 1000) - 3600); // 1 hour ago in seconds

  return {
    tokenAmount: parseUnits('10', 6),
    rewardTokenAmount: parseUnits('12', 6),
    routeDeadline: expiredTime,
    rewardDeadline: expiredTime,
    ...overrides,
  };
}

/**
 * Create options for an intent with insufficient funding
 *
 * Should be rejected by funding validation
 */
export function createInsufficientFundingOptions(
  overrides: Partial<PublishIntentOptions> = {},
): PublishIntentOptions {
  return {
    tokenAmount: parseUnits('10', 6),
    rewardTokenAmount: parseUnits('12', 6),
    fundingOptions: {
      allowPartial: true,
      approveAmount: parseUnits('6', 6), // Only 50% of required
    },
    ...overrides,
  };
}

/**
 * Create options for an intent with invalid prover address
 *
 * Should be rejected by prover validation
 */
export function createInvalidProverOptions(
  overrides: Partial<PublishIntentOptions> = {},
): PublishIntentOptions {
  const invalidProverEvm = '0x1111111111111111111111111111111111111111' as Address;
  const invalidProver = AddressNormalizer.normalize(
    invalidProverEvm,
    ChainType.EVM,
  ) as UniversalAddress;

  return {
    tokenAmount: parseUnits('10', 6),
    rewardTokenAmount: parseUnits('12', 6),
    proverAddress: invalidProver,
    ...overrides,
  };
}

/**
 * Create options for an intent with large token amount (boundary testing)
 *
 * Should test route amount limit validation
 */
export function createLargeAmountOptions(
  overrides: Partial<PublishIntentOptions> = {},
): PublishIntentOptions {
  return {
    tokenAmount: parseUnits('100', 6), // 100 USDC (above 50 USDC limit)
    rewardTokenAmount: parseUnits('120', 6), // Proportional reward
    ...overrides,
  };
}

/**
 * Create options for an intent with minimal amounts
 *
 * Boundary testing with very small amounts
 */
export function createMinimalAmountOptions(
  overrides: Partial<PublishIntentOptions> = {},
): PublishIntentOptions {
  return {
    tokenAmount: parseUnits('0.01', 6), // 0.01 USDC (1 cent)
    rewardTokenAmount: parseUnits('0.02', 6), // 0.02 USDC reward
    ...overrides,
  };
}

/**
 * Create options for an intent with native token (ETH)
 *
 * Tests native token handling in addition to ERC20
 */
export function createNativeTokenOptions(
  overrides: Partial<PublishIntentOptions> = {},
): PublishIntentOptions {
  return {
    tokenAmount: parseUnits('10', 6), // Still transfer USDC
    rewardTokenAmount: parseUnits('12', 6),
    nativeAmount: parseUnits('0.01', 18), // 0.01 ETH on destination
    rewardNativeAmount: parseUnits('0.015', 18), // 0.015 ETH reward
    ...overrides,
  };
}

/**
 * Create options for an intent with custom deadlines
 *
 * Useful for testing deadline edge cases
 */
export function createCustomDeadlineOptions(
  routeDeadline: bigint,
  rewardDeadline: bigint,
  overrides: Partial<PublishIntentOptions> = {},
): PublishIntentOptions {
  return {
    tokenAmount: parseUnits('10', 6),
    rewardTokenAmount: parseUnits('12', 6),
    routeDeadline,
    rewardDeadline,
    ...overrides,
  };
}

/**
 * Helper: Create future timestamp (X seconds from now)
 */
export function futureTimestamp(secondsFromNow: number): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + secondsFromNow);
}

/**
 * Helper: Create past timestamp (X seconds ago)
 */
export function pastTimestamp(secondsAgo: number): bigint {
  return BigInt(Math.floor(Date.now() / 1000) - secondsAgo);
}

// =============================================================================
// ADVANCED VALIDATION TEST SCENARIOS
// The following fixtures test edge cases and validation failures using
// IntentBuilder's customization options (customRouteToken, customCalls, etc.)
// =============================================================================

/**
 * Create options for an intent with invalid token address
 *
 * Tests: routeTokenValidation
 * Status: IMPLEMENTED
 *
 * Uses IntentBuilder's `customRouteToken` option to specify a non-whitelisted
 * token address (0x9999...9999) that should be rejected by route token validation.
 *
 * Example usage:
 *   const { intentHash } = await publishIntent(createInvalidTokenOptions());
 *   await waitForRejection(intentHash, ctx);
 *   await expectIntent(intentHash, ctx).toHaveBeenRejected();
 */
export function createInvalidTokenOptions(
  overrides: Partial<PublishIntentOptions> = {},
): PublishIntentOptions {
  const invalidToken = '0x9999999999999999999999999999999999999999' as Address;
  const invalidTokenUA = AddressNormalizer.normalize(
    invalidToken,
    ChainType.EVM,
  ) as UniversalAddress;

  return {
    tokenAmount: parseUnits('10', 6),
    rewardTokenAmount: parseUnits('12', 6),
    customRouteToken: invalidTokenUA,
    ...overrides,
  };
}

/**
 * Create options for an intent with invalid route calls
 *
 * Tests: routeCallsValidation
 * Status: IMPLEMENTED
 *
 * Uses IntentBuilder's `customCalls` option to specify a call to the Portal
 * contract instead of the token contract, which should be rejected by route
 * calls validation.
 *
 * Example usage:
 *   const { intentHash } = await publishIntent(createInvalidCallsOptions());
 *   await waitForRejection(intentHash, ctx);
 *   await expectIntent(intentHash, ctx).toHaveBeenRejected();
 */
export function createInvalidCallsOptions(
  overrides: Partial<PublishIntentOptions> = {},
): PublishIntentOptions {
  // Invalid: calling Portal contract instead of token
  const portalAddress = '0x399Dbd5DF04f83103F77A58cBa2B7c4d3cdede97' as Address;
  const portalUA = AddressNormalizer.normalize(portalAddress, ChainType.EVM) as UniversalAddress;

  return {
    tokenAmount: parseUnits('10', 6),
    rewardTokenAmount: parseUnits('12', 6),
    customCalls: [{ target: portalUA, value: 0n, data: '0x' as `0x${string}` }],
    ...overrides,
  };
}

/**
 * Create options for an intent with duplicate reward tokens
 *
 * Tests: duplicateRewardTokensValidation
 * Status: IMPLEMENTED
 *
 * Uses IntentBuilder's `rewardTokens` option to specify an array with the
 * same token (USDC) appearing twice in the reward tokens list, which should
 * be rejected by duplicate reward tokens validation.
 *
 * Example usage:
 *   const { intentHash } = await publishIntent(createDuplicateRewardTokensOptions());
 *   await waitForRejection(intentHash, ctx);
 *   await expectIntent(intentHash, ctx).toHaveBeenRejected();
 */
export function createDuplicateRewardTokensOptions(
  overrides: Partial<PublishIntentOptions> = {},
): PublishIntentOptions {
  const usdcAddress = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as Address; // Base USDC
  const usdcUA = AddressNormalizer.normalize(usdcAddress, ChainType.EVM) as UniversalAddress;

  const duplicateTokens = [
    { token: usdcUA, amount: parseUnits('10', 6) },
    { token: usdcUA, amount: parseUnits('2', 6) }, // Same token twice - invalid!
  ];

  return {
    tokenAmount: parseUnits('10', 6),
    rewardTokenAmount: parseUnits('12', 6),
    rewardTokens: duplicateTokens,
    ...overrides,
  };
}

/**
 * Create options for an intent with unsupported destination chain
 *
 * Tests: chainSupportValidation
 * Status: IMPLEMENTED
 *
 * Uses IntentBuilder's `allowInvalidChain` option to bypass chain validation,
 * allowing the creation of an intent with an unsupported chain ID (999).
 * Requires `customRouteToken` and `customSourceToken` since the unsupported
 * chain has no configuration. Should be rejected by chain support validation.
 *
 * Example usage:
 *   const { intentHash } = await publishIntent(createUnsupportedChainOptions());
 *   await waitForRejection(intentHash, ctx);
 *   await expectIntent(intentHash, ctx).toHaveBeenRejected();
 */
export function createUnsupportedChainOptions(
  overrides: Partial<PublishIntentOptions> = {},
): PublishIntentOptions {
  // Need to provide custom tokens since chain 999 has no config
  const usdcAddress = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as Address; // Base USDC
  const usdcUA = AddressNormalizer.normalize(usdcAddress, ChainType.EVM) as UniversalAddress;

  return {
    tokenAmount: parseUnits('10', 6),
    rewardTokenAmount: parseUnits('12', 6),
    destinationChainId: 999, // Unsupported chain
    allowInvalidChain: true, // Bypass IntentBuilder validation
    customRouteToken: usdcUA, // Must provide token since chain has no config
    customSourceToken: usdcUA, // Must provide source token too
    ...overrides,
  };
}
