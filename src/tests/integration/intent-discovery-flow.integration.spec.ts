import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';

import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { IntentStatus } from '@/common/interfaces/intent.interface';
import { BigintSerializer } from '@/common/utils/bigint-serializer';
import { BlockchainModule } from '@/modules/blockchain/blockchain.module';
import { BasicWalletFactory } from '@/modules/blockchain/evm/wallets/basic-wallet/basic-wallet.factory';
import { KernelWalletFactory } from '@/modules/blockchain/evm/wallets/kernel-wallet/kernel-wallet.factory';
import { ConfigModule } from '@/modules/config/config.module';
import { FulfillmentModule } from '@/modules/fulfillment/fulfillment.module';
import { FULFILLMENT_STRATEGY_NAMES } from '@/modules/fulfillment/types/strategy-name.type';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';
import { IntentsModule } from '@/modules/intents/intents.module';
import { IntentsService } from '@/modules/intents/intents.service';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';
import { QueueModule } from '@/modules/queue/queue.module';

// Increase Jest timeout for integration tests
jest.setTimeout(30000);

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

describe.skip('Intent Discovery Flow Integration', () => {
  let module: TestingModule;
  let eventEmitter: EventEmitter2;
  let intentsService: IntentsService;
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
    const blockchainModule = await BlockchainModule.forRootAsync();

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
        blockchainModule,
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
    fulfillmentQueue = module.get<Queue>(getQueueToken(QueueNames.INTENT_FULFILLMENT));
    executionQueue = module.get<Queue>(getQueueToken(QueueNames.INTENT_EXECUTION));

    // Ensure queues are clean
    await fulfillmentQueue.obliterate({ force: true });
    await executionQueue.obliterate({ force: true });
  }, 30000);

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
  }, 30000);

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
      const savedIntent = await intentsService.findByID(mockIntent.intentHash);
      expect(savedIntent).toBeDefined();
      expect(savedIntent?.intentHash).toBe(mockIntent.intentHash);
      expect(savedIntent?.status).toBe(IntentStatus.PENDING);

      // Verify intent was added to fulfillment queue
      const jobs = await fulfillmentQueue.getJobs(['waiting', 'active']);
      expect(jobs).toHaveLength(1);

      const job = jobs[0];
      const jobData = BigintSerializer.deserialize(job.data);
      expect(jobData).toHaveProperty('strategy', FULFILLMENT_STRATEGY_NAMES.STANDARD);
      expect(jobData).toHaveProperty('intent');
      // expect(jobData.intentHash).toBe(mockIntent.intentHash);
    });
  });
});
