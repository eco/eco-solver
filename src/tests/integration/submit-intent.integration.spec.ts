import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';

// Increase Jest timeout for integration tests
jest.setTimeout(30000);

describe('SubmitIntent Integration Test', () => {
  let app: INestApplication;
  let fulfillmentService: FulfillmentService;

  beforeAll(async () => {
    console.log('Starting integration test...');
    console.log('Make sure MongoDB and Redis are running locally');
    console.log('MongoDB should be on: mongodb://localhost:27017/test');
    console.log('Redis should be on: localhost:6379');
    
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      fulfillmentService = app.get<FulfillmentService>(FulfillmentService);
      console.log('Application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize application. Make sure MongoDB and Redis are running:', error.message);
      throw new Error('Prerequisites not met: MongoDB and Redis must be running. Start them with: docker-compose up -d mongodb redis');
    }
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should submit an intent through the fulfillment service using AppModule', async () => {
    // Create a mock intent using the helper
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
    
    // Verify the result
    expect(result).toBeDefined();
    expect(result.intentHash).toBe(mockIntent.intentHash);
    expect(result.destination).toBe(mockIntent.destination);
    expect(result.sourceChainId).toBe(mockIntent.sourceChainId);
  }, 10000);
});