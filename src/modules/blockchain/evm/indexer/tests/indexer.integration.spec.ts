import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { SystemLoggerService } from '@/modules/logging';

import { IndexerService } from '../indexer.service';
import { IndexerConfigService } from '../indexer-config.service';

/**
 * Integration tests for IndexerService
 * These tests run against the actual indexer at https://indexer.eco.com/
 *
 * To run these tests:
 * EVM_INDEXER_URL=https://indexer.eco.com/ pnpm test -- indexer.integration.spec.ts
 */
describe('IndexerService Integration', () => {
  let service: IndexerService;
  let configService: IndexerConfigService;

  // Real indexer configuration
  const indexerUrl = process.env.EVM_INDEXER_URL || 'https://indexer.eco.com/';

  // Example portal addresses (these should be real portal contracts)
  // Update these with actual portal addresses from your EVM networks
  const testPortalAddresses = [
    '0x0000000000000000000000000000000000000000', // Placeholder - update with real address
  ];

  beforeAll(async () => {
    if (!process.env.EVM_INDEXER_URL) {
      console.warn(
        'Skipping integration tests: EVM_INDEXER_URL not set. Set it to run integration tests.',
      );
    }

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'evm.indexer') {
          return {
            url: indexerUrl,
            intervals: {
              intentPublished: 2000,
              intentFunded: 5000,
              intentFulfilled: 5000,
              intentWithdrawn: 60000,
            },
          };
        }
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndexerService,
        IndexerConfigService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: SystemLoggerService,
          useValue: {
            setContext: jest.fn(),
            debug: jest.fn(),
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<IndexerService>(IndexerService);
    configService = module.get<IndexerConfigService>(IndexerConfigService);
  });

  // Skip tests if EVM_INDEXER_URL is not set
  const testIf = (condition: boolean) => (condition ? it : it.skip);

  describe('queryPublishedIntents', () => {
    testIf(!!process.env.EVM_INDEXER_URL)(
      'should fetch published intents from real indexer',
      async () => {
        // Query from 24 hours ago
        const since = BigInt(Math.floor(Date.now() / 1000) - 86400);

        const results: any[] = [];
        let batchCount = 0;

        try {
          for await (const batch of service.queryPublishedIntents({
            portalAddresses: testPortalAddresses,
            since,
          })) {
            results.push(...batch);
            batchCount++;

            // Limit to first 3 batches for testing
            if (batchCount >= 3) break;
          }

          console.log(`Fetched ${results.length} published intents in ${batchCount} batches`);

          // Verify structure of results
          if (results.length > 0) {
            const intent = results[0];
            expect(intent).toHaveProperty('hash');
            expect(intent).toHaveProperty('chainId');
            expect(intent).toHaveProperty('params');
            expect(intent).toHaveProperty('transactionHash');
            expect(intent).toHaveProperty('blockNumber');
            expect(intent).toHaveProperty('blockTimestamp');
            expect(intent).toHaveProperty('evt_log_address');

            // Verify BigInt fields are properly typed
            expect(typeof intent.blockNumber).toBe('bigint');
            expect(typeof intent.blockTimestamp).toBe('bigint');
          }
        } catch (error) {
          console.error('Integration test error:', error);
          throw error;
        }
      },
      30000, // 30s timeout
    );

    testIf(!!process.env.EVM_INDEXER_URL)(
      'should handle pagination correctly',
      async () => {
        const since = BigInt(0); // Query all historical data
        let totalItems = 0;
        let batchCount = 0;

        for await (const batch of service.queryPublishedIntents({
          portalAddresses: testPortalAddresses,
          since,
        })) {
          totalItems += batch.length;
          batchCount++;

          console.log(`Batch ${batchCount}: ${batch.length} items`);

          // Each batch should have <= 50 items (max page size)
          expect(batch.length).toBeLessThanOrEqual(50);

          // Limit to first 2 batches for testing
          if (batchCount >= 2) break;
        }

        console.log(`Total: ${totalItems} items across ${batchCount} batches`);
        expect(batchCount).toBeGreaterThan(0);
      },
      30000, // 30s timeout
    );
  });

  describe('queryFulfilledIntents', () => {
    testIf(!!process.env.EVM_INDEXER_URL)(
      'should fetch fulfilled intents from real indexer',
      async () => {
        const since = BigInt(Math.floor(Date.now() / 1000) - 86400);

        const results: any[] = [];
        for await (const batch of service.queryFulfilledIntents({
          portalAddresses: testPortalAddresses,
          since,
        })) {
          results.push(...batch);
          // Limit for testing
          if (results.length >= 50) break;
        }

        console.log(`Fetched ${results.length} fulfilled intents`);

        if (results.length > 0) {
          const fulfillment = results[0];
          expect(fulfillment).toHaveProperty('hash');
          expect(fulfillment).toHaveProperty('chainId');
          expect(fulfillment).toHaveProperty('transactionHash');
          expect(typeof fulfillment.blockNumber).toBe('bigint');
        }
      },
      30000,
    );
  });

  describe('queryWithdrawnIntents', () => {
    testIf(!!process.env.EVM_INDEXER_URL)(
      'should fetch withdrawn intents from real indexer',
      async () => {
        const since = BigInt(Math.floor(Date.now() / 1000) - 86400);

        const results: any[] = [];
        for await (const batch of service.queryWithdrawnIntents({
          portalAddresses: testPortalAddresses,
          since,
        })) {
          results.push(...batch);
          if (results.length >= 50) break;
        }

        console.log(`Fetched ${results.length} withdrawn intents`);

        if (results.length > 0) {
          const withdrawal = results[0];
          expect(withdrawal).toHaveProperty('hash');
          expect(withdrawal).toHaveProperty('transactionHash');
        }
      },
      30000,
    );
  });

  describe('queryFundedIntents', () => {
    testIf(!!process.env.EVM_INDEXER_URL)(
      'should fetch funded intents (refunds) from real indexer',
      async () => {
        const since = BigInt(Math.floor(Date.now() / 1000) - 86400);

        const results: any[] = [];
        for await (const batch of service.queryFundedIntents({
          portalAddresses: testPortalAddresses,
          since,
        })) {
          results.push(...batch);
          if (results.length >= 50) break;
        }

        console.log(`Fetched ${results.length} funded intents (refunds)`);

        if (results.length > 0) {
          const refund = results[0];
          expect(refund).toHaveProperty('hash');
          expect(refund).toHaveProperty('transactionHash');
        }
      },
      30000,
    );
  });

  describe('Error Handling', () => {
    testIf(!!process.env.EVM_INDEXER_URL)(
      'should handle invalid portal addresses gracefully',
      async () => {
        const since = BigInt(Math.floor(Date.now() / 1000) - 86400);

        // This should return empty results, not throw
        const results: any[] = [];
        for await (const batch of service.queryPublishedIntents({
          portalAddresses: ['0xInvalidAddress'],
          since,
        })) {
          results.push(...batch);
        }

        // Should complete without throwing
        expect(results.length).toBeGreaterThanOrEqual(0);
      },
      30000,
    );
  });

  describe('Configuration', () => {
    it('should have correct indexer URL configured', () => {
      expect(configService.url).toBe(indexerUrl);
    });

    it('should have default intervals configured', () => {
      const intervals = configService.intervals;
      expect(intervals.intentPublished).toBe(2000);
      expect(intervals.intentFunded).toBe(5000);
      expect(intervals.intentFulfilled).toBe(5000);
      expect(intervals.intentWithdrawn).toBe(60000);
    });

    it('should report as configured', () => {
      expect(configService.isConfigured()).toBe(true);
    });
  });
});
