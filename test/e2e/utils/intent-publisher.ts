import { Address, Hex, parseUnits } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';

import { IntentBuilder } from '../helpers/intent-builder.helper';
import { TEST_ACCOUNTS } from '../helpers/test-app.helper';

/**
 * Options for publishing an intent
 */
export interface PublishIntentOptions {
  // Chain configuration
  sourceChain?: 'base' | 'optimism';
  destinationChain?: 'base' | 'optimism';

  // Token amounts
  tokenAmount?: bigint;
  rewardTokenAmount?: bigint;

  // Intent parameters
  recipient?: Address;
  routeDeadline?: bigint;
  rewardDeadline?: bigint;
  proverAddress?: UniversalAddress;
  creatorAddress?: Address;
  nativeAmount?: bigint;
  rewardNativeAmount?: bigint;

  // Funding options
  fundingOptions?: {
    allowPartial?: boolean;
    approveAmount?: bigint; // Override approval amount for testing insufficient funding
  };
}

/**
 * Result of publishing an intent
 */
export interface PublishIntentResult {
  intent: Intent;
  intentHash: Hex;
  vault: Address;
  txHash: Hex;
}

/**
 * Global intent builder instance for managing test account state
 */
let globalBuilder: IntentBuilder | null = null;

/**
 * Get or create the global intent builder instance
 */
function getBuilder(): IntentBuilder {
  if (!globalBuilder) {
    globalBuilder = new IntentBuilder();
  }
  return globalBuilder;
}

/**
 * Publish an intent with sensible defaults
 *
 * This function wraps IntentBuilder with a clean, simple API and sensible defaults:
 * - Source: Base Mainnet
 * - Destination: Optimism Mainnet
 * - Token amount: 10 USDC
 * - Reward: 12 USDC (covers route + fees)
 * - Recipient: TEST_ACCOUNTS.ACCOUNT_1
 * - Deadlines: 1 hour from now
 * - Creator: TEST_ACCOUNTS.ACCOUNT_0
 *
 * Usage:
 *   // Valid intent with defaults
 *   const { intent, intentHash } = await publishIntent();
 *
 *   // Custom token amount
 *   const result = await publishIntent({ tokenAmount: parseUnits('20', 6) });
 *
 *   // Insufficient funding (for testing rejection)
 *   const result = await publishIntent({
 *     fundingOptions: {
 *       allowPartial: true,
 *       approveAmount: parseUnits('6', 6), // Only 50% of required
 *     },
 *   });
 *
 *   // Expired deadline (for testing rejection)
 *   const result = await publishIntent({
 *     routeDeadline: BigInt(Date.now() - 3600000), // 1 hour ago
 *     rewardDeadline: BigInt(Date.now() - 3600000),
 *   });
 *
 * @param options - Optional configuration overrides
 * @returns Intent details including hash, vault address, and transaction hash
 */
export async function publishIntent(
  options: PublishIntentOptions = {},
): Promise<PublishIntentResult> {
  const {
    sourceChain = 'base',
    destinationChain = 'optimism',
    tokenAmount = parseUnits('10', 6), // 10 USDC (within 50 USDC limit)
    rewardTokenAmount = parseUnits('12', 6), // 12 USDC reward (covers route + fees)
    recipient = TEST_ACCOUNTS.ACCOUNT_1.address as Address,
    routeDeadline = BigInt(Date.now() + 3600000), // 1 hour from now
    rewardDeadline = BigInt(Date.now() + 3600000), // 1 hour from now
    proverAddress,
    creatorAddress = TEST_ACCOUNTS.ACCOUNT_0.address as Address,
    nativeAmount = 0n,
    rewardNativeAmount = 0n,
    fundingOptions,
  } = options;

  // Build the intent using IntentBuilder
  const builder = getBuilder()
    .withSourceChain(sourceChain)
    .withDestinationChain(destinationChain)
    .withTokenAmount(tokenAmount)
    .withRewardTokenAmount(rewardTokenAmount)
    .withRecipient(recipient)
    .withRouteDeadline(routeDeadline)
    .withRewardDeadline(rewardDeadline)
    .withCreatorAddress(creatorAddress)
    .withNativeAmount(nativeAmount)
    .withRewardNativeAmount(rewardNativeAmount);

  // Set prover if provided
  if (proverAddress) {
    builder.withProverAddress(proverAddress);
  }

  const intent = builder.build();

  // Publish and fund the intent
  const { intentHash, vault, txHash } = await builder.publishAndFund(intent, fundingOptions);

  // Update intent with actual values from contract
  intent.intentHash = intentHash;
  intent.vaultAddress = vault;
  intent.publishTxHash = txHash;

  // Wait for funding confirmation
  const { isFunded } = await builder.waitForIntentFunding(intent, 15000);
  if (!isFunded && !fundingOptions?.allowPartial) {
    throw new Error(`Intent funding failed: ${intentHash}`);
  }

  return {
    intent,
    intentHash,
    vault,
    txHash,
  };
}
