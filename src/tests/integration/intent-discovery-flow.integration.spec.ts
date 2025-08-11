import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';

import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { IntentStatus } from '@/common/interfaces/intent.interface';
import { BlockchainModule } from '@/modules/blockchain/blockchain.module';
import { BasicWalletFactory } from '@/modules/blockchain/evm/wallets/basic-wallet/basic-wallet.factory';
import { KernelWalletFactory } from '@/modules/blockchain/evm/wallets/kernel-wallet/kernel-wallet.factory';
import { ConfigModule } from '@/modules/config/config.module';
import { FulfillmentModule } from '@/modules/fulfillment/fulfillment.module';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { FULFILLMENT_STRATEGY_NAMES } from '@/modules/fulfillment/types/strategy-name.type';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';
import { IntentsModule } from '@/modules/intents/intents.module';
import { IntentsService } from '@/modules/intents/intents.service';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';
import { QueueModule } from '@/modules/queue/queue.module';
import { QueueSerializer } from '@/modules/queue/utils/queue-serializer';

// Mock wallet factories
const mockWallet = {
  getAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
  writeContract: jest.fn().mockResolvedValue('0xTransactionHash'),
  writeContracts: jest.fn().mockResolvedValue(['0xTransactionHash']),
  readContract: jest.fn(),
  readContracts: jest.fn().mockResolvedValue([]),
};

const mockBasicWalletFactory = {
  name: 'basic',
  createWallet: jest.fn().mockResolvedValue(mockWallet),
};

const mockKernelWalletFactory = {
  name: 'kernel',
  createWallet: jest.fn().mockResolvedValue(mockWallet),
};

describe('Intent Discovery Flow Integration', () => {
  let module: TestingModule;
  let eventEmitter: EventEmitter2;
  let intentsService: IntentsService;
  let _fulfillmentService: FulfillmentService;
  let fulfillmentQueue: Queue;
  let executionQueue: Queue;
  let mongoServer: MongoMemoryServer;
  let redisClient: Redis;

  beforeAll(async () => {
    // Start MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Create Redis client for testing
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    });

    // Clear Redis before tests
    await redisClient.flushdb();

    // Create testing module with real modules
    module = await Test.createTestingModule({
      imports: [
        ConfigModule,
        EventEmitterModule.forRoot({
          wildcard: true,
          delimiter: '.',
          maxListeners: 10,
          verboseMemoryLeak: false,
          ignoreErrors: false,
        }),
        MongooseModule.forRoot(mongoUri),
        BullModule.forRoot({
          connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
          },
        }),
        QueueModule,
        IntentsModule,
        BlockchainModule.forRootAsync(),
        FulfillmentModule,
      ],
    })
      .overrideProvider(BasicWalletFactory)
      .useValue(mockBasicWalletFactory)
      .overrideProvider(KernelWalletFactory)
      .useValue(mockKernelWalletFactory)
      .compile();

    // Initialize the application to ensure all lifecycle hooks are executed
    await module.init();

    // Get service instances
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    intentsService = module.get<IntentsService>(IntentsService);
    _fulfillmentService = module.get<FulfillmentService>(FulfillmentService);
    fulfillmentQueue = module.get<Queue>(getQueueToken(QueueNames.INTENT_FULFILLMENT));
    executionQueue = module.get<Queue>(getQueueToken(QueueNames.INTENT_EXECUTION));

    // Ensure queues are clean
    await fulfillmentQueue.obliterate({ force: true });
    await executionQueue.obliterate({ force: true });
  });

  afterAll(async () => {
    // Clean up
    if (fulfillmentQueue) {
      await fulfillmentQueue.close();
    }
    if (executionQueue) {
      await executionQueue.close();
    }
    if (redisClient) {
      await redisClient.quit();
    }
    if (module) {
      await module.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    // Clear queues before each test
    await fulfillmentQueue.drain();
    await executionQueue.drain();
    await fulfillmentQueue.clean(0, 0, 'completed');
    await fulfillmentQueue.clean(0, 0, 'failed');
    await executionQueue.clean(0, 0, 'completed');
    await executionQueue.clean(0, 0, 'failed');
  });

  describe('Happy Path', () => {
    it('should process intent from discovery event to fulfillment queue', async () => {
      const mockIntent = createMockIntent({
        intentHash: '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1',
      });

      // Emit intent discovered event
      await eventEmitter.emitAsync('intent.discovered', {
        intent: mockIntent,
        strategy: FULFILLMENT_STRATEGY_NAMES.STANDARD,
      });

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify intent was saved to database
      const savedIntent = await intentsService.findById(mockIntent.intentHash);
      expect(savedIntent).toBeDefined();
      expect(savedIntent.intentId).toBe(mockIntent.intentHash);
      expect(savedIntent.status).toBe(IntentStatus.PENDING);

      // Verify intent was added to fulfillment queue
      const jobs = await fulfillmentQueue.getJobs(['waiting', 'active']);
      expect(jobs).toHaveLength(1);

      const job = jobs[0];
      const jobData = QueueSerializer.deserialize(job.data);
      expect(jobData).toHaveProperty('strategy', FULFILLMENT_STRATEGY_NAMES.STANDARD);
      expect(jobData).toHaveProperty('intent');
      // expect(jobData.intentHash).toBe(mockIntent.intentHash);
    });
  });

  // describe('Duplicate Intent Handling', () => {
  //   it('should not re-queue duplicate intents', async () => {
  //     const mockIntent = createMockIntent({
  //       intentHash: '0xdup123def456abc123def456abc123def456abc123def456abc123def456dup1',
  //     });
  //
  //     // Emit first intent discovered event
  //     await eventEmitter.emitAsync('intent.discovered', {
  //       intent: mockIntent,
  //       strategy: FULFILLMENT_STRATEGY_NAMES.STANDARD,
  //     });
  //
  //     // Wait for processing
  //     await new Promise((resolve) => setTimeout(resolve, 100));
  //
  //     // Verify first intent was queued
  //     let jobs = await fulfillmentQueue.getJobs(['waiting', 'active']);
  //     expect(jobs).toHaveLength(1);
  //
  //     // Emit duplicate intent discovered event
  //     await eventEmitter.emitAsync('intent.discovered', {
  //       intent: mockIntent,
  //       strategy: FULFILLMENT_STRATEGY_NAMES.STANDARD,
  //     });
  //
  //     // Wait for processing
  //     await new Promise((resolve) => setTimeout(resolve, 100));
  //
  //     // Verify only one job exists in queue
  //     jobs = await fulfillmentQueue.getJobs(['waiting', 'active']);
  //     expect(jobs).toHaveLength(1);
  //
  //     // Verify intent exists only once in database
  //     const savedIntent = await intentsService.findById(mockIntent.intentHash);
  //     expect(savedIntent).toBeDefined();
  //     expect(savedIntent.intentId).toBe(mockIntent.intentHash);
  //   });
  // });
  //
  // describe('Multiple Strategies', () => {
  //   it('should handle different strategy selections correctly', async () => {
  //     const strategies = [
  //       FULFILLMENT_STRATEGY_NAMES.STANDARD,
  //       FULFILLMENT_STRATEGY_NAMES.CROWD_LIQUIDITY,
  //       FULFILLMENT_STRATEGY_NAMES.NATIVE_INTENTS,
  //     ];
  //
  //     const intents: Intent[] = [];
  //
  //     // Create and emit intents with different strategies
  //     for (let i = 0; i < strategies.length; i++) {
  //       const intent = createMockIntent({
  //         intentHash: `0xstrat${i}def456abc123def456abc123def456abc123def456abc123def4${i}abc1`,
  //       });
  //       intents.push(intent);
  //
  //       await eventEmitter.emitAsync('intent.discovered', {
  //         intent,
  //         strategy: strategies[i],
  //       });
  //     }
  //
  //     // Wait for processing
  //     await new Promise((resolve) => setTimeout(resolve, 200));
  //
  //     // Verify all intents were queued with correct strategies
  //     const jobs = await fulfillmentQueue.getJobs(['waiting', 'active']);
  //     expect(jobs).toHaveLength(strategies.length);
  //
  //     // Verify each job has the correct strategy
  //     for (let i = 0; i < jobs.length; i++) {
  //       const job = jobs.find((j) => {
  //         const data = QueueSerializer.deserialize(j.data);
  //         return data.intent.intentHash === intents[i].intentHash;
  //       });
  //       expect(job).toBeDefined();
  //       const jobData = QueueSerializer.deserialize(job.data);
  //       expect(jobData.strategy).toBe(strategies[i]);
  //     }
  //
  //     // Verify all intents were saved to database
  //     for (const intent of intents) {
  //       const savedIntent = await intentsService.findById(intent.intentHash);
  //       expect(savedIntent).toBeDefined();
  //       expect(savedIntent.intentId).toBe(intent.intentHash);
  //     }
  //   });
  // });
  //
  // describe('Concurrent Events', () => {
  //   it('should handle multiple concurrent intent discoveries', async () => {
  //     const intentCount = 10;
  //     const intents: Intent[] = [];
  //     const promises: Promise<void>[] = [];
  //
  //     // Create multiple intents
  //     for (let i = 0; i < intentCount; i++) {
  //       const intent = createMockIntent({
  //         intentHash: `0xconc${i.toString().padStart(2, '0')}def456abc123def456abc123def456abc123def456abc123de${i}`,
  //       });
  //       intents.push(intent);
  //
  //       // Emit events concurrently
  //       const promise = eventEmitter.emitAsync('intent.discovered', {
  //         intent,
  //         strategy: FULFILLMENT_STRATEGY_NAMES.STANDARD,
  //       }).then(() => {}); // Convert to Promise<void>
  //       promises.push(promise);
  //     }
  //
  //     // Wait for all events to be processed
  //     await Promise.all(promises);
  //     await new Promise((resolve) => setTimeout(resolve, 300));
  //
  //     // Verify all intents were queued
  //     const jobs = await fulfillmentQueue.getJobs(['waiting', 'active']);
  //     expect(jobs).toHaveLength(intentCount);
  //
  //     // Verify all intents were saved to database
  //     for (const intent of intents) {
  //       const savedIntent = await intentsService.findById(intent.intentHash);
  //       expect(savedIntent).toBeDefined();
  //       expect(savedIntent.intentId).toBe(intent.intentHash);
  //     }
  //
  //     // Verify each job has unique intent
  //     const uniqueHashes = new Set(jobs.map((job) => {
  //       const data = QueueSerializer.deserialize(job.data);
  //       return data.intent.intentHash;
  //     }));
  //     expect(uniqueHashes.size).toBe(intentCount);
  //   });
  // });
  //
  // describe('Error Scenarios', () => {
  //   it('should handle invalid strategy gracefully', async () => {
  //     const mockIntent = createMockIntent({
  //       intentHash: '0xerr123def456abc123def456abc123def456abc123def456abc123def456err1',
  //     });
  //
  //     // Emit intent with invalid strategy
  //     await eventEmitter.emitAsync('intent.discovered', {
  //       intent: mockIntent,
  //       strategy: 'INVALID_STRATEGY' as any,
  //     });
  //
  //     // Wait for processing
  //     await new Promise((resolve) => setTimeout(resolve, 100));
  //
  //     // Intent should still be saved
  //     const savedIntent = await intentsService.findById(mockIntent.intentHash);
  //     expect(savedIntent).toBeDefined();
  //
  //     // Intent should be queued even with invalid strategy
  //     const jobs = await fulfillmentQueue.getJobs(['waiting', 'active']);
  //     expect(jobs).toHaveLength(1);
  //     const jobData = QueueSerializer.deserialize(jobs[0].data);
  //     expect(jobData.strategy).toBe('INVALID_STRATEGY');
  //   });
  //
  //   it('should handle malformed intent data', async () => {
  //     const malformedIntent = {
  //       intentHash: '0xmal123def456abc123def456abc123def456abc123def456abc123def456mal1',
  //       // Missing required fields
  //     };
  //
  //     // Emit intent with malformed data
  //     await eventEmitter.emitAsync('intent.discovered', {
  //       intent: malformedIntent as any,
  //       strategy: FULFILLMENT_STRATEGY_NAMES.STANDARD,
  //     });
  //
  //     // Wait for processing
  //     await new Promise((resolve) => setTimeout(resolve, 100));
  //
  //     // Verify no job was added to queue due to validation error
  //     const jobs = await fulfillmentQueue.getJobs(['waiting', 'active', 'failed']);
  //     // The exact behavior depends on validation implementation
  //     // This test ensures the system doesn't crash with malformed data
  //   });
  // });
});
