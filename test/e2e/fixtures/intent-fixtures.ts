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
  const expiredTime = BigInt(Date.now() - 3600000); // 1 hour ago

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
  return BigInt(Date.now() + secondsFromNow * 1000);
}

/**
 * Helper: Create past timestamp (X seconds ago)
 */
export function pastTimestamp(secondsAgo: number): bigint {
  return BigInt(Date.now() - secondsAgo * 1000);
}
