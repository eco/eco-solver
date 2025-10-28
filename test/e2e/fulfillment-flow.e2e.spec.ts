import { INestApplication } from '@nestjs/common';

import { Address, parseUnits } from 'viem';

import { IntentStatus } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType } from '@/common/utils/chain-type-detector';
import { IntentsService } from '@/modules/intents/intents.service';

import { fundKernelWallet, fundTestAccountsWithUSDC } from './helpers/fund-test-account';
import {
  createTestAppWithServer,
  TEST_ACCOUNTS,
  TOKEN_ADDRESSES,
  waitForApp,
} from './helpers/test-app.helper';
import {
  BalanceTracker,
  initializeVerificationHelpers,
  initializeWaitHelpers,
  publishIntent,
  verifyIntentStatus,
  verifyNoFulfillmentEvent,
  verifyNotFulfilled,
  waitForFulfillment,
  waitForRejection,
} from './utils';

/**
 * Intent Fulfillment E2E Tests
 *
 * Tests the complete intent fulfillment flow:
 * - Valid cross-chain transfers
 * - Validation failures (funding, deadlines, provers)
 *
 * Prerequisites:
 * - Docker Compose has started MongoDB, Redis, and Anvil instances
 * - Base Mainnet fork running on localhost:8545
 * - Optimism Mainnet fork running on localhost:9545
 */
describe('Intent Fulfillment', () => {
  let app: INestApplication;
  let baseUrl: string;

  // Setup: Start the NestJS application
  beforeAll(async () => {
    console.log('\n=== Starting Intent Fulfillment Tests ===\n');

    const result = await createTestAppWithServer();
    app = result.app;
    baseUrl = result.baseUrl;

    // Initialize framework helpers with IntentsService
    const intentsService = app.get(IntentsService);
    initializeWaitHelpers(intentsService);
    initializeVerificationHelpers(intentsService);

    await waitForApp(baseUrl);
    console.log(`Application ready at ${baseUrl}\n`);

    // Fund test account with USDC
    await fundTestAccountsWithUSDC();
    console.log('✓ Test account funded\n');

    // Fund Kernel wallet (used by executor)
    await fundKernelWallet();
  }, 120000);

  // Teardown
  afterAll(async () => {
    if (app) {
      await app.close();
      console.log('\n=== Intent Fulfillment Tests Completed ===\n');
    }
  });

  it('fulfills valid cross-chain transfer', async () => {
    console.log('\n--- Test: Valid Cross-Chain Transfer ---');

    // Track recipient balance
    const balances = new BalanceTracker(
      'optimism',
      TOKEN_ADDRESSES.OPTIMISM_USDC as Address,
      TEST_ACCOUNTS.ACCOUNT_1.address as Address,
    );
    await balances.snapshot();

    // Publish intent with framework
    const { intentHash } = await publishIntent({
      tokenAmount: parseUnits('10', 6),
      rewardTokenAmount: parseUnits('12', 6),
      recipient: TEST_ACCOUNTS.ACCOUNT_1.address as Address,
    });

    console.log(`Intent published: ${intentHash}`);

    // Wait for fulfillment
    await waitForFulfillment(intentHash);
    console.log('Intent fulfilled! ✓');

    // Verify balance increased
    await balances.verifyIncreased(parseUnits('10', 6));
    console.log('Balance verified ✓');

    // Verify intent status
    await verifyIntentStatus(intentHash, IntentStatus.FULFILLED);
    console.log('Status verified ✓');

    console.log('\n✅ Valid cross-chain transfer test PASSED\n');
  }, 30_000);

  it('rejects insufficient funding', async () => {
    console.log('\n--- Test: Insufficient Funding ---');

    // Publish with insufficient funding (only 50% approved)
    const { intentHash } = await publishIntent({
      tokenAmount: parseUnits('10', 6),
      rewardTokenAmount: parseUnits('12', 6),
      fundingOptions: {
        allowPartial: true,
        approveAmount: parseUnits('6', 6), // Only 50%
      },
    });

    console.log(`Intent published with partial funding: ${intentHash}`);

    // Wait and verify NOT fulfilled
    await waitForRejection(intentHash);
    console.log('Intent rejected (as expected) ✓');

    // Verify status
    await verifyNotFulfilled(intentHash);
    console.log('Status verified ✓');

    // Verify no fulfillment event
    await verifyNoFulfillmentEvent(intentHash);
    console.log('No fulfillment event ✓');

    console.log('\n✅ Insufficient funding test PASSED\n');
  }, 120000);

  it('rejects expired deadline', async () => {
    console.log('\n--- Test: Expired Deadline ---');

    const expiredTime = BigInt(Date.now() - 3600000); // 1 hour ago

    // Publish with expired deadlines
    const { intentHash } = await publishIntent({
      tokenAmount: parseUnits('10', 6),
      rewardTokenAmount: parseUnits('12', 6),
      routeDeadline: expiredTime,
      rewardDeadline: expiredTime,
    });

    console.log(`Intent published with expired deadlines: ${intentHash}`);

    // Wait and verify NOT fulfilled
    await waitForRejection(intentHash);
    console.log('Intent rejected (as expected) ✓');

    // Verify status
    await verifyNotFulfilled(intentHash);
    console.log('Status verified ✓');

    // Verify no fulfillment event
    await verifyNoFulfillmentEvent(intentHash);
    console.log('No fulfillment event ✓');

    console.log('\n✅ Expired deadline test PASSED\n');
  }, 120000);

  it('rejects invalid prover', async () => {
    console.log('\n--- Test: Invalid Prover ---');

    // Create invalid prover address
    const invalidProverEvm = '0x1111111111111111111111111111111111111111' as Address;
    const invalidProver = AddressNormalizer.normalize(
      invalidProverEvm,
      ChainType.EVM,
    ) as UniversalAddress;

    // Publish with invalid prover
    const { intentHash } = await publishIntent({
      tokenAmount: parseUnits('10', 6),
      rewardTokenAmount: parseUnits('12', 6),
      proverAddress: invalidProver,
    });

    console.log(`Intent published with invalid prover: ${intentHash}`);

    // Wait and verify NOT fulfilled
    await waitForRejection(intentHash);
    console.log('Intent rejected (as expected) ✓');

    // Verify status
    await verifyNotFulfilled(intentHash);
    console.log('Status verified ✓');

    // Verify no fulfillment event
    await verifyNoFulfillmentEvent(intentHash);
    console.log('No fulfillment event ✓');

    console.log('\n✅ Invalid prover test PASSED\n');
  }, 120000);
});
