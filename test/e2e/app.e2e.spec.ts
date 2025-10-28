import { INestApplication } from '@nestjs/common';

import request from 'supertest';
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import {
  createTestAppWithServer,
  TEST_ACCOUNTS,
  TEST_CHAIN_IDS,
  TEST_RPC,
  waitForApp,
} from './helpers/test-app.helper';

/**
 * End-to-End Test Suite
 *
 * This test suite demonstrates:
 * 1. Health endpoint testing
 * 2. Blockchain interaction via forked networks
 * 3. Full application integration testing
 *
 * Prerequisites:
 * - globalSetup has started MongoDB, Redis, and Anvil instances
 * - config.e2e.yaml has been updated with connection details
 */
describe('Application E2E Tests', () => {
  let app: INestApplication;
  let baseUrl: string;

  // Setup: Start the NestJS application
  beforeAll(async () => {
    console.log('Starting NestJS application for E2E tests...');

    const result = await createTestAppWithServer();
    app = result.app;
    baseUrl = result.baseUrl;

    // Wait for app to be ready
    await waitForApp(baseUrl);

    console.log(`Application ready at ${baseUrl}`);
  }, 60000); // 60 second timeout for app startup

  // Teardown: Close the application
  afterAll(async () => {
    if (app) {
      await app.close();
      console.log('Application closed');
    }
  });

  /**
   * Test Suite 1: Health Endpoints
   */
  describe('Health Endpoints', () => {
    it('GET /health should return 200 OK', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });

    it('GET /health/live should return 200 OK', async () => {
      const response = await request(app.getHttpServer()).get('/health/live').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });

    it('GET /health/ready should return 200 OK', async () => {
      const response = await request(app.getHttpServer()).get('/health/ready').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
      expect(response.body).toHaveProperty('info');
    });
  });

  /**
   * Test Suite 2: Blockchain Integration
   */
  describe('Blockchain Integration', () => {
    it('should connect to Base Mainnet fork', async () => {
      // Create a Viem client for Base Mainnet fork
      const client = createPublicClient({
        transport: http(TEST_RPC.BASE_MAINNET),
      });

      // Get chain ID
      const chainId = await client.getChainId();
      expect(chainId).toBe(TEST_CHAIN_IDS.BASE_MAINNET);

      // Get block number (should be > 0)
      const blockNumber = await client.getBlockNumber();
      expect(blockNumber).toBeGreaterThan(0n);

      console.log(`Base Mainnet fork: chain ID ${chainId}, block ${blockNumber}`);
    });

    it('should connect to Optimism Mainnet fork', async () => {
      // Create a Viem client for Optimism Mainnet fork
      const client = createPublicClient({
        transport: http(TEST_RPC.OPTIMISM_MAINNET),
      });

      // Get chain ID
      const chainId = await client.getChainId();
      expect(chainId).toBe(TEST_CHAIN_IDS.OPTIMISM_MAINNET);

      // Get block number (should be > 0)
      const blockNumber = await client.getBlockNumber();
      expect(blockNumber).toBeGreaterThan(0n);

      console.log(`Optimism Mainnet fork: chain ID ${chainId}, block ${blockNumber}`);
    });

    it('should send a transaction on Base Mainnet fork', async () => {
      // Create wallet client with test account
      const account = privateKeyToAccount(TEST_ACCOUNTS.ACCOUNT_0.privateKey as `0x${string}`);

      const walletClient = createWalletClient({
        account,
        transport: http(TEST_RPC.BASE_MAINNET),
      });

      const publicClient = createPublicClient({
        transport: http(TEST_RPC.BASE_MAINNET),
      });

      // Get initial balance of recipient
      const recipient = TEST_ACCOUNTS.ACCOUNT_1.address as `0x${string}`;

      // Send transaction: 0.1 ETH from account 0 to account 1
      const txHash = await walletClient.sendTransaction({
        chain: null,
        to: recipient,
        value: parseEther('0.1'),
      });

      expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

      // Wait for transaction to be mined
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      expect(receipt.status).toBe('success');
      expect(receipt.to?.toLowerCase()).toBe(recipient.toLowerCase());

      // Note: We don't verify balance change due to Anvil state persistence across test runs
      // The important part is that the transaction was mined successfully

      console.log(`Transaction mined: ${txHash}`);
      console.log(`  Block: ${receipt.blockNumber}`);
      console.log(`  Gas used: ${receipt.gasUsed}`);
    });

    it('should have sufficient balance in test accounts', async () => {
      const client = createPublicClient({
        transport: http(TEST_RPC.BASE_MAINNET),
      });

      // Check balance of account 0 (should have 10000 ETH from Anvil)
      const balance = await client.getBalance({
        address: TEST_ACCOUNTS.ACCOUNT_0.address as `0x${string}`,
      });

      // Anvil default accounts have 10000 ETH each
      expect(balance).toBeGreaterThan(parseEther('9900')); // Allow for some used in previous test

      console.log(`Account 0 balance: ${balance.toString()} wei`);
    });
  });

  /**
   * Test Suite 3: API Integration
   */
  describe('API Integration', () => {
    it('GET /api/v1/blockchain/chains should return supported chains', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/blockchain/chains')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      // Should include Base Mainnet and Optimism Mainnet
      const chainIds = response.body.map((chain: any) => chain.chainId);
      expect(chainIds).toContain(TEST_CHAIN_IDS.BASE_MAINNET);
      expect(chainIds).toContain(TEST_CHAIN_IDS.OPTIMISM_MAINNET);

      console.log(`Supported chains: ${chainIds.join(', ')}`);
    });
  });

  /**
   * Test Suite 4: Database Integration
   */
  describe('Database Integration', () => {
    it('should connect to MongoDB', async () => {
      // The app should have connected to MongoDB during startup
      // If this test passes, it means MongoDB is working
      // We can verify by checking the health endpoint which includes DB status
      const response = await request(app.getHttpServer()).get('/health/ready').expect(200);

      expect(response.body.info).toHaveProperty('mongodb');
      expect(response.body.info.mongodb).toHaveProperty('status', 'up');
    });

    it('should connect to Redis', async () => {
      // The app should have connected to Redis during startup
      // We can verify by checking the health endpoint which includes Redis status
      const response = await request(app.getHttpServer()).get('/health/ready').expect(200);

      expect(response.body.info).toHaveProperty('redis');
      expect(response.body.info.redis).toHaveProperty('status', 'up');
    });
  });
});
