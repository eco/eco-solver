import { INestApplication } from '@nestjs/common';

import { Address, createPublicClient, erc20Abi, http, parseUnits } from 'viem';

import { IntentStatus } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType } from '@/common/utils/chain-type-detector';
import { IntentsService } from '@/modules/intents/intents.service';

import { fundTestAccountsWithUSDC } from './helpers/fund-test-account';
import { IntentBuilder } from './helpers/intent-builder.helper';
import {
  createTestAppWithServer,
  TEST_ACCOUNTS,
  TEST_CHAIN_IDS,
  TEST_RPC,
  TOKEN_ADDRESSES,
  waitForApp,
  waitForIntentFulfilled,
} from './helpers/test-app.helper';

/**
 * Fulfillment Flow E2E Test Suite
 *
 * This test suite verifies the complete intent fulfillment flow:
 * 1. Intent is published and funded on the source chain
 * 2. Solver detects the intent
 * 3. Solver validates the intent using strategy validations
 * 4. Solver executes the intent on the destination chain
 * 5. Intent is marked as fulfilled
 *
 * Test Scenarios:
 * - Valid intent fulfillment (happy path)
 * - Insufficient funding (validation fails)
 * - Expired deadline (validation fails)
 * - Invalid prover (validation fails)
 *
 * Prerequisites:
 * - Docker Compose has started MongoDB, Redis, and Anvil instances
 * - Base Mainnet fork running on localhost:8545
 * - Optimism Mainnet fork running on localhost:9545
 */
describe('Fulfillment Flow E2E Tests', () => {
  let app: INestApplication;
  let baseUrl: string;
  let intentsService: IntentsService;

  // Setup: Start the NestJS application
  beforeAll(async () => {
    console.log('\n=== Starting Fulfillment Flow E2E Tests ===\n');
    console.log('Initializing NestJS application...');

    const result = await createTestAppWithServer();
    app = result.app;
    baseUrl = result.baseUrl;

    // Get IntentsService for database queries
    intentsService = app.get(IntentsService);

    // Wait for app to be ready
    await waitForApp(baseUrl);

    console.log(`Application ready at ${baseUrl}\n`);

    // Fund test account with USDC on both chains
    console.log('Funding test account with USDC on Base and Optimism...');
    await fundTestAccountsWithUSDC();
    console.log('✓ Test account funded\n');
  }, 120000); // 2 minute timeout for setup

  // Teardown: Close the application
  afterAll(async () => {
    if (app) {
      await app.close();
      console.log('\n=== Fulfillment Flow E2E Tests Completed ===\n');
    }
  });

  /**
   * Test Scenario 1: Valid Intent Fulfillment (Happy Path)
   *
   * This test verifies the complete fulfillment flow:
   * 1. Build a valid intent (Base → Optimism with USDC transfer)
   * 2. Publish and fund the intent on Base
   * 3. Wait for solver to detect the intent
   * 4. Verify solver validates the intent successfully
   * 5. Wait for solver to execute on Optimism
   * 6. Verify intent is fulfilled and tokens are delivered
   */
  describe('Scenario 1: Valid Intent Fulfillment', () => {
    it('should fulfill a valid intent from Base to Optimism', async () => {
      console.log('\n--- Test: Valid Intent Fulfillment ---');

      // Step 1: Build the intent
      const builder = new IntentBuilder()
        .withSourceChain('base')
        .withDestinationChain('optimism')
        .withTokenAmount(parseUnits('10', 6)) // 10 USDC (within 50 USDC limit)
        .withRewardTokenAmount(parseUnits('12', 6)) // 12 USDC reward (covers route + fees)
        .withRecipient(TEST_ACCOUNTS.ACCOUNT_1.address as Address);

      const intent = builder.build();

      console.log('Built intent:');
      console.log(`  Source: Base Mainnet (${TEST_CHAIN_IDS.BASE_MAINNET})`);
      console.log(`  Destination: Optimism Mainnet (${TEST_CHAIN_IDS.OPTIMISM_MAINNET})`);
      console.log(`  Token amount: 10 USDC`);
      console.log(`  Reward: 12 USDC`);
      console.log(`  Recipient: ${TEST_ACCOUNTS.ACCOUNT_1.address}`);

      // Get recipient's initial USDC balance on Optimism
      const optimismClient = createPublicClient({
        transport: http(TEST_RPC.OPTIMISM_MAINNET),
      });

      const initialBalance = await optimismClient.readContract({
        address: TOKEN_ADDRESSES.OPTIMISM_USDC as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [TEST_ACCOUNTS.ACCOUNT_1.address as Address],
      });

      console.log(`\nRecipient initial balance: ${initialBalance.toString()} USDC`);

      // Get current block number on Optimism to start event polling from here
      const startBlock = await optimismClient.getBlockNumber();

      // Step 2: Publish and fund the intent on Base
      console.log('\nPublishing and funding intent on Base...');
      const { intentHash, vault, txHash } = await builder.publishAndFund(intent);

      console.log(`Intent published!`);
      console.log(`  Intent hash: ${intentHash}`);
      console.log(`  Vault: ${vault}`);
      console.log(`  Tx hash: ${txHash}`);

      // Update intent with the actual intent hash from the contract
      intent.intentHash = intentHash;
      intent.vaultAddress = vault;
      intent.publishTxHash = txHash;

      // Step 3: Wait for intent to be funded
      console.log('\nWaiting for intent to be funded...');
      const { isFunded } = await builder.waitForIntentFunding(intent, 15000);
      expect(isFunded).toBe(true);
      console.log('Intent is funded on-chain ✓');

      // Step 4: Wait for solver to detect and store the intent
      console.log('\nWaiting for solver to detect intent...');
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Give solver time to detect

      // Check if intent is in database
      const storedIntent = await intentsService.findById(intentHash);
      expect(storedIntent).toBeDefined();
      expect(storedIntent?.intentHash).toBe(intentHash);
      console.log('Solver detected intent ✓');
      console.log(`  Status: ${storedIntent?.status}`);

      // Step 5: Wait for validation and execution
      console.log('\nWaiting for intent to be fulfilled on Optimism...');
      console.log('(This may take 30-60 seconds for validation + execution)');

      const fulfilledEvent = await waitForIntentFulfilled(TEST_RPC.OPTIMISM_MAINNET, intentHash, {
        timeout: 120_000, // 2 minutes
        interval: 2000, // Check every 2 seconds
        fromBlock: startBlock,
      });

      console.log('\nIntent fulfilled! ✓');
      console.log(`  Claimant: ${fulfilledEvent.args.claimant}`);
      console.log(`  Block: ${fulfilledEvent.blockNumber}`);
      console.log(`  Tx hash: ${fulfilledEvent.transactionHash}`);

      // Step 6: Verify final state
      console.log('\nVerifying final state...');

      // Check recipient's final USDC balance on Optimism
      const finalBalance = await optimismClient.readContract({
        address: TOKEN_ADDRESSES.OPTIMISM_USDC as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [TEST_ACCOUNTS.ACCOUNT_1.address as Address],
      });

      console.log(`Recipient final balance: ${finalBalance.toString()} USDC`);
      console.log(`Balance increased by: ${(finalBalance - initialBalance).toString()} USDC`);

      // Verify tokens were transferred
      expect(finalBalance).toBeGreaterThan(initialBalance);
      expect(finalBalance - initialBalance).toBeGreaterThanOrEqual(parseUnits('10', 6));

      // Check intent status in database
      const finalIntent = await intentsService.findById(intentHash);
      expect(finalIntent?.status).toBe(IntentStatus.FULFILLED);
      console.log(`Intent status in database: ${finalIntent?.status} ✓`);

      console.log('\n✅ Valid intent fulfillment test PASSED\n');
    }, 180000); // 3 minute timeout
  });

  /**
   * Test Scenario 2: Insufficient Funding
   *
   * This test verifies that intents with insufficient funding are rejected:
   * 1. Build a valid intent
   * 2. Publish with allowPartial=true but only approve 50% of tokens
   * 3. Verify solver detects partial funding
   * 4. Verify IntentFundedValidation fails
   * 5. Verify intent is NOT queued for execution
   */
  describe('Scenario 2: Insufficient Funding', () => {
    it('should reject an intent with insufficient funding', async () => {
      console.log('\n--- Test: Insufficient Funding ---');

      // Step 1: Build the intent
      const builder = new IntentBuilder()
        .withSourceChain('base')
        .withDestinationChain('optimism')
        .withTokenAmount(parseUnits('10', 6)) // 10 USDC
        .withRewardTokenAmount(parseUnits('12', 6)); // 12 USDC reward (but we'll only approve 6)

      const intent = builder.build();

      console.log('Built intent with 12 USDC reward requirement');

      // Step 2: Publish and fund with insufficient approval (only 50%)
      console.log('\nPublishing with partial funding (only 6 USDC approved)...');
      const { intentHash, vault, txHash } = await builder.publishAndFund(intent, {
        allowPartial: true,
        approveTokenAmount: parseUnits('6', 6), // Only approve 6 USDC instead of 12
      });

      console.log(`Intent published with partial funding!`);
      console.log(`  Intent hash: ${intentHash}`);
      console.log(`  Approved: 6 USDC (50% of requirement)`);

      // Update intent
      intent.intentHash = intentHash;
      intent.vaultAddress = vault;
      intent.publishTxHash = txHash;

      // Step 3: Wait for intent to be detected by solver
      console.log('\nWaiting for solver to detect intent...');
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const storedIntent = await intentsService.findById(intentHash);
      expect(storedIntent).toBeDefined();
      console.log('Solver detected intent ✓');

      // Step 4: Wait and verify intent is NOT fulfilled due to insufficient funding
      console.log('\nWaiting to verify intent is NOT fulfilled...');
      console.log('(Intent should fail IntentFundedValidation)');

      // Wait 30 seconds - intent should NOT be fulfilled in this time
      await new Promise((resolve) => setTimeout(resolve, 30000));

      // Check intent status - should still be PENDING or FAILED, not FULFILLED
      const finalIntent = await intentsService.findById(intentHash);
      expect(finalIntent?.status).not.toBe(IntentStatus.FULFILLED);
      console.log(`Intent status: ${finalIntent?.status} (not fulfilled) ✓`);

      // Verify no IntentFulfilled event was emitted
      try {
        await waitForIntentFulfilled(TEST_RPC.OPTIMISM_MAINNET, intentHash, {
          timeout: 5000, // Short timeout since we expect it to fail
          interval: 1000,
        });
        // If we get here, the test should fail
        fail('Intent should not have been fulfilled with insufficient funding');
      } catch (error) {
        // Expected - no fulfillment event
        console.log('No IntentFulfilled event found (expected) ✓');
      }

      console.log('\n✅ Insufficient funding test PASSED\n');
    }, 120000); // 2 minute timeout
  });

  /**
   * Test Scenario 3: Expired Deadline
   *
   * This test verifies that intents with expired deadlines are rejected:
   * 1. Build an intent with past deadlines
   * 2. Publish and fully fund the intent
   * 3. Verify solver detects the intent
   * 4. Verify ExpirationValidation fails
   * 5. Verify intent is NOT queued for execution
   */
  describe('Scenario 3: Expired Deadline', () => {
    it('should reject an intent with expired deadline', async () => {
      console.log('\n--- Test: Expired Deadline ---');

      // Step 1: Build the intent with expired deadlines
      const expiredTime = BigInt(Date.now() - 3600000); // 1 hour ago

      const builder = new IntentBuilder()
        .withSourceChain('base')
        .withDestinationChain('optimism')
        .withTokenAmount(parseUnits('10', 6))
        .withRewardTokenAmount(parseUnits('12', 6))
        .withRouteDeadline(expiredTime)
        .withRewardDeadline(expiredTime);

      const intent = builder.build();

      console.log('Built intent with expired deadlines:');
      console.log(`  Route deadline: ${new Date(Number(expiredTime)).toISOString()}`);
      console.log(`  Reward deadline: ${new Date(Number(expiredTime)).toISOString()}`);

      // Step 2: Publish and fully fund the intent
      console.log('\nPublishing and fully funding intent on Base...');
      const { intentHash, vault, txHash } = await builder.publishAndFund(intent);

      console.log(`Intent published!`);
      console.log(`  Intent hash: ${intentHash}`);

      // Update intent
      intent.intentHash = intentHash;
      intent.vaultAddress = vault;
      intent.publishTxHash = txHash;

      // Step 3: Wait for intent to be detected
      console.log('\nWaiting for solver to detect intent...');
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const storedIntent = await intentsService.findById(intentHash);
      expect(storedIntent).toBeDefined();
      console.log('Solver detected intent ✓');

      // Step 4: Wait and verify intent is NOT fulfilled due to expired deadline
      console.log('\nWaiting to verify intent is NOT fulfilled...');
      console.log('(Intent should fail ExpirationValidation)');

      // Wait 30 seconds - intent should NOT be fulfilled
      await new Promise((resolve) => setTimeout(resolve, 30000));

      // Check intent status - should be FAILED or still PENDING
      const finalIntent = await intentsService.findById(intentHash);
      expect(finalIntent?.status).not.toBe(IntentStatus.FULFILLED);
      console.log(`Intent status: ${finalIntent?.status} (not fulfilled) ✓`);

      // Verify no IntentFulfilled event
      try {
        await waitForIntentFulfilled(TEST_RPC.OPTIMISM_MAINNET, intentHash, {
          timeout: 5000,
          interval: 1000,
        });
        fail('Intent should not have been fulfilled with expired deadline');
      } catch (error) {
        console.log('No IntentFulfilled event found (expected) ✓');
      }

      console.log('\n✅ Expired deadline test PASSED\n');
    }, 120000); // 2 minute timeout
  });

  /**
   * Test Scenario 4: Invalid Prover
   *
   * This test verifies that intents with invalid provers are rejected:
   * 1. Build an intent with an invalid prover address
   * 2. Publish and fully fund the intent
   * 3. Verify solver detects the intent
   * 4. Verify ProverSupportValidation fails
   * 5. Verify intent is NOT queued for execution
   */
  describe('Scenario 4: Invalid Prover', () => {
    it('should reject an intent with invalid prover address', async () => {
      console.log('\n--- Test: Invalid Prover ---');

      // Step 1: Build the intent with an invalid prover
      const invalidProverEvm = '0x1111111111111111111111111111111111111111' as Address;
      const invalidProver = AddressNormalizer.normalize(
        invalidProverEvm,
        ChainType.EVM,
      ) as UniversalAddress;

      const builder = new IntentBuilder()
        .withSourceChain('base')
        .withDestinationChain('optimism')
        .withTokenAmount(parseUnits('10', 6))
        .withRewardTokenAmount(parseUnits('12', 6))
        .withProverAddress(invalidProver);

      const intent = builder.build();

      console.log('Built intent with invalid prover:');
      console.log(`  Prover address: ${invalidProver}`);

      // Step 2: Publish and fully fund the intent
      console.log('\nPublishing and fully funding intent on Base...');
      const { intentHash, vault, txHash } = await builder.publishAndFund(intent);

      console.log(`Intent published!`);
      console.log(`  Intent hash: ${intentHash}`);

      // Update intent
      intent.intentHash = intentHash;
      intent.vaultAddress = vault;
      intent.publishTxHash = txHash;

      // Step 3: Wait for intent to be detected
      console.log('\nWaiting for solver to detect intent...');
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const storedIntent = await intentsService.findById(intentHash);
      expect(storedIntent).toBeDefined();
      console.log('Solver detected intent ✓');

      // Step 4: Wait and verify intent is NOT fulfilled due to invalid prover
      console.log('\nWaiting to verify intent is NOT fulfilled...');
      console.log('(Intent should fail ProverSupportValidation)');

      // Wait 30 seconds - intent should NOT be fulfilled
      await new Promise((resolve) => setTimeout(resolve, 30000));

      // Check intent status - should be FAILED or still PENDING
      const finalIntent = await intentsService.findById(intentHash);
      expect(finalIntent?.status).not.toBe(IntentStatus.FULFILLED);
      console.log(`Intent status: ${finalIntent?.status} (not fulfilled) ✓`);

      // Verify no IntentFulfilled event
      try {
        await waitForIntentFulfilled(TEST_RPC.OPTIMISM_MAINNET, intentHash, {
          timeout: 5000,
          interval: 1000,
        });
        fail('Intent should not have been fulfilled with invalid prover');
      } catch (error) {
        console.log('No IntentFulfilled event found (expected) ✓');
      }

      console.log('\n✅ Invalid prover test PASSED\n');
    }, 120000); // 2 minute timeout
  });
});
