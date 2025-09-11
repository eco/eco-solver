import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { type Hex } from 'viem';

import { AppModule } from '@/app.module';
import { UniversalAddress } from '@/common/types/universal-address.type';

// Helper function to cast string to UniversalAddress
const toUniversalAddress = (address: string): UniversalAddress => address as UniversalAddress;
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';

// Increase Jest timeout for integration tests
jest.setTimeout(30000);

// Skip this test by default unless INTEGRATION_TESTS environment variable is set
const shouldRunIntegrationTests = process.env.INTEGRATION_TESTS === 'true';

const describeIntegration = shouldRunIntegrationTests ? describe : describe.skip;

describeIntegration('Standard Fulfillment Flow Integration', () => {
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
      console.error(
        'Failed to initialize application. Make sure MongoDB and Redis are running:',
        error.message,
      );
      throw new Error(
        'Prerequisites not met: MongoDB and Redis must be running. Start them with: docker-compose up -d mongodb redis',
      );
    }
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should submit an intent through the fulfillment service', async () => {
    const intent = {
      intentHash: '0xdc779634f98449124f207abc4265d7e2149f2c86ddc53564b71f50a6cd9e4ff6' as Hex,
      destination: 8453n,
      route: {
        salt: '0x00786dc142b348787e289e76c147768cbc0a5e7da852d6492b7992ea8730a05d' as Hex,
        deadline: 1756338836n,
        portal: toUniversalAddress(
          '0x00000000000000000000000090F0c8aCC1E083Bcb4F487f84FC349ae8d5e28D7',
        ),
        nativeAmount: 0n,
        tokens: [
          {
            token: toUniversalAddress(
              '0x000000000000000000000000833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            ),
            amount: 10000n,
          },
        ],
        calls: [
          {
            target: toUniversalAddress(
              '0x000000000000000000000000833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            ),
            data: '0xa9059cbb000000000000000000000000256b70644f5d77bc8e2bb82c731ddf747ecb14710000000000000000000000000000000000000000000000000000000000002710' as Hex,
            value: 0n,
          },
        ],
      },
      reward: {
        deadline: 1756342436n,
        creator: toUniversalAddress(
          '0x00000000000000000000000090F0c8aCC1E083Bcb4F487f84FC349ae8d5e28D7',
        ),
        prover: toUniversalAddress(
          '0x00000000000000000000000001f914e5dF8CFEA1913eC1c4C974266f3A7822F7',
        ),
        nativeAmount: 0n,
        tokens: [
          {
            token: toUniversalAddress(
              '0x0000000000000000000000000b2C639c533813f4Aa9D7837CAf62653d097Ff85',
            ),
            amount: 10000n,
          },
        ],
      },
      sourceChainId: 10n,
    };

    console.log('Submitting intent with hash:', intent.intentHash);

    // Call submitIntent as it would be called in production
    await fulfillmentService.submitIntent(intent, 'standard');

    console.log('Intent submitted successfully to fulfillment queue');

    // If it doesn't throw, the test passes
    expect(true).toBe(true);
  }, 10000);
});
