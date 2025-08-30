import { BullModule } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';

import Redis from 'ioredis';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { AppModule } from '@/app.module';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';

// Increase Jest timeout for integration tests
jest.setTimeout(30000);

describe.skip('SubmitIntent Integration Test', () => {
  let app: INestApplication;
  let fulfillmentService: FulfillmentService;
  let mongoServer: MongoMemoryServer;
  let redisClient: Redis;

  beforeAll(async () => {
    console.log('Starting integration test...');

    // Start MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    console.log('MongoDB Memory Server started at:', mongoUri);

    // Create Redis client for testing
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });

    try {
      await redisClient.connect();
      await redisClient.flushdb();
      console.log('Redis connected and flushed');
    } catch (error) {
      console.warn('Redis not available, using memory fallback for queues');
      // Don't fail the test if Redis is not available
    }

    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideModule(MongooseModule)
        .useModule(MongooseModule.forRoot(mongoUri))
        .overrideModule(BullModule)
        .useModule(
          BullModule.forRoot({
            connection: {
              host: process.env.REDIS_HOST || 'localhost',
              port: parseInt(process.env.REDIS_PORT || '6379'),
            },
          }),
        )
        .compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      fulfillmentService = app.get<FulfillmentService>(FulfillmentService);
      console.log('Application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize application:', error.message);
      throw error;
    }
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (redisClient) {
      try {
        await redisClient.quit();
      } catch (error) {
        // Ignore errors when closing Redis connection
      }
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('should submit an intent through the fulfillment service using AppModule', async () => {
    // Create a mock intent using the helper with proper structure
    const mockIntent = createMockIntent({
      sourceChainId: 10n,
      destination: 8453n,
      reward: {
        prover: '0x01f914e5dF8CFEA1913eC1c4C974266f3A7822F7' as any,
        creator: '0x90F0c8aCC1E083Bcb4F487f84FC349ae8d5e28D7' as any,
        deadline: BigInt(Date.now() / 1000 + 86400), // 24 hours from now in seconds
        nativeAmount: 0n,
        tokens: [
          {
            token: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' as any,
            amount: 10000n,
          },
        ],
      },
      route: {
        salt: '0x00786dc142b348787e289e76c147768cbc0a5e7da852d6492b7992ea8730a05d' as any,
        deadline: BigInt(Date.now() / 1000 + 86400), // 24 hours from now in seconds
        portal: '0x90F0c8aCC1E083Bcb4F487f84FC349ae8d5e28D7' as any,
        nativeAmount: 0n,
        tokens: [
          {
            token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as any,
            amount: 10000n,
          },
        ],
        calls: [
          {
            target: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as any,
            data: '0xa9059cbb000000000000000000000000256b70644f5d77bc8e2bb82c731ddf747ecb14710000000000000000000000000000000000000000000000000000000000002710' as any,
            value: 0n,
          },
        ],
      },
    });

    console.log('Submitting intent with hash:', mockIntent.intentHash);

    // Call submitIntent as it would be called in production
    const result = await fulfillmentService.submitIntent(mockIntent, 'standard');

    console.log('Intent submitted successfully to fulfillment queue');

    // Verify the result - the submitIntent method should return the intent
    expect(result).toBeDefined();
    expect(result.intentHash).toBe(mockIntent.intentHash);
    expect(result.destination).toBe(mockIntent.destination);
    expect(result.sourceChainId).toBe(mockIntent.sourceChainId);
  }, 10000);
});
