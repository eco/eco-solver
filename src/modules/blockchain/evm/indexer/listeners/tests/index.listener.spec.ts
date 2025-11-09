import { SystemLoggerService } from '@/modules/logging';
import { QueueService } from '@/modules/queue/queue.service';

import { IndexerService } from '../../indexer.service';
import { IndexerConfigService } from '../../indexer-config.service';
import type {
  IndexedFulfillment,
  IndexedIntent,
  IndexedRefund,
  IndexedWithdrawal,
} from '../../types/intent.types';
import { IndexListener } from '../index.listener';

describe('IndexListener', () => {
  let indexListener: IndexListener;
  let mockIndexerService: jest.Mocked<IndexerService>;
  let mockQueueService: jest.Mocked<QueueService>;
  let mockIndexerConfigService: jest.Mocked<IndexerConfigService>;
  let mockLogger: jest.Mocked<SystemLoggerService>;

  const chainConfigs = [
    {
      chainId: 1,
      portalAddresses: ['0x1234567890123456789012345678901234567890'],
    },
    {
      chainId: 10,
      portalAddresses: ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'],
    },
  ];

  const allPortalAddresses = chainConfigs.flatMap((c) => c.portalAddresses);

  beforeEach(async () => {
    // Create mock services
    mockIndexerService = {
      queryPublishedIntents: jest.fn(),
      queryFulfilledIntents: jest.fn(),
      queryWithdrawnIntents: jest.fn(),
      queryFundedIntents: jest.fn(),
    } as any;

    mockQueueService = {
      addBlockchainEvent: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockIndexerConfigService = {
      isConfigured: jest.fn().mockReturnValue(true),
      intervals: {
        intentPublished: 2000,
        intentFunded: 5000,
        intentFulfilled: 5000,
        intentWithdrawn: 60000,
      },
    } as any;

    mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Create IndexListener instance
    indexListener = new IndexListener(
      chainConfigs,
      mockIndexerService,
      mockQueueService,
      mockIndexerConfigService,
      mockLogger,
    );
  });

  afterEach(async () => {
    await indexListener.stop();
  });

  describe('start', () => {
    it('should log warning if IndexerService is not available', async () => {
      const listenerWithoutIndexer = new IndexListener(
        chainConfigs,
        null,
        mockQueueService,
        mockIndexerConfigService,
        mockLogger,
      );

      await listenerWithoutIndexer.start();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'IndexerService not available, skipping IndexListener',
      );
    });

    it('should log warning if indexer is not configured', async () => {
      mockIndexerConfigService.isConfigured.mockReturnValue(false);

      await indexListener.start();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Indexer not configured, skipping IndexListener',
      );
    });

    it('should start polling for all event types', async () => {
      await indexListener.start();

      expect(mockLogger.log).toHaveBeenCalledWith('Starting IndexListener');
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('IntentPublished events (2000ms interval)'),
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('IntentFulfilled events (5000ms interval)'),
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('IntentWithdrawn events (60000ms interval)'),
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('IntentFunded events (5000ms interval)'),
      );
    });
  });

  describe('stop', () => {
    it('should unsubscribe all subscriptions', async () => {
      await indexListener.start();
      await indexListener.stop();

      expect(mockLogger.log).toHaveBeenCalledWith('Stopping IndexListener');
    });

    it('should clear subscriptions array', async () => {
      await indexListener.start();
      await indexListener.stop();

      // Starting again should work without errors
      await indexListener.start();
      expect(mockLogger.log).toHaveBeenCalledWith('Starting IndexListener');
    });
  });

  describe('fetchPublishedIntents', () => {
    it('should fetch and convert published intents to BlockchainEventJob', async () => {
      const mockIntent: IndexedIntent = {
        hash: '0xintent123',
        chainId: 1,
        params: { test: 'data' },
        transactionHash: '0xtx123',
        blockNumber: BigInt(100),
        blockTimestamp: BigInt(1000),
        evt_log_address: chainConfigs[0].portalAddresses[0],
        evt_log_index: 0,
        from: '0xfrom',
      };

      // Mock async iterator
      mockIndexerService.queryPublishedIntents.mockReturnValue(
        (async function* () {
          yield [mockIntent];
        })(),
      );

      await indexListener.start();

      // Wait for polling interval to trigger
      await new Promise((resolve) => setTimeout(resolve, 2100));

      expect(mockIndexerService.queryPublishedIntents).toHaveBeenCalledWith({
        portalAddresses: allPortalAddresses,
        since: BigInt(0),
      });

      expect(mockQueueService.addBlockchainEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'IntentPublished',
          chainId: 1,
          chainType: 'evm',
          contractName: 'portal',
          intentHash: '0xintent123',
        }),
      );
    });

    it('should filter out events from unsupported chains', async () => {
      const mockIntent: IndexedIntent = {
        hash: '0xintent123',
        chainId: 999, // Unsupported chain
        params: { test: 'data' },
        transactionHash: '0xtx123',
        blockNumber: BigInt(100),
        blockTimestamp: BigInt(1000),
        evt_log_address: chainConfigs[0].portalAddresses[0],
        evt_log_index: 0,
        from: '0xfrom',
      };

      mockIndexerService.queryPublishedIntents.mockReturnValue(
        (async function* () {
          yield [mockIntent];
        })(),
      );

      await indexListener.start();
      await new Promise((resolve) => setTimeout(resolve, 2100));

      expect(mockQueueService.addBlockchainEvent).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Received intent from unsupported chain 999, skipping',
      );
    });

    it('should handle events from multiple supported chains', async () => {
      const mockIntentChain1: IndexedIntent = {
        hash: '0xintent1',
        chainId: 1,
        params: {},
        transactionHash: '0xtx1',
        blockNumber: BigInt(100),
        blockTimestamp: BigInt(1000),
        evt_log_address: chainConfigs[0].portalAddresses[0],
        evt_log_index: 0,
        from: '0xfrom',
      };

      const mockIntentChain10: IndexedIntent = {
        hash: '0xintent10',
        chainId: 10,
        params: {},
        transactionHash: '0xtx10',
        blockNumber: BigInt(200),
        blockTimestamp: BigInt(2000),
        evt_log_address: chainConfigs[1].portalAddresses[0],
        evt_log_index: 0,
        from: '0xfrom',
      };

      mockIndexerService.queryPublishedIntents.mockReturnValue(
        (async function* () {
          yield [mockIntentChain1, mockIntentChain10];
        })(),
      );

      await indexListener.start();
      await new Promise((resolve) => setTimeout(resolve, 2100));

      // Both events should be queued
      expect(mockQueueService.addBlockchainEvent).toHaveBeenCalledTimes(2);
      expect(mockQueueService.addBlockchainEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 1,
          intentHash: '0xintent1',
        }),
      );
      expect(mockQueueService.addBlockchainEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 10,
          intentHash: '0xintent10',
        }),
      );
    });

    it('should update last timestamp correctly per chain', async () => {
      const mockIntents: IndexedIntent[] = [
        {
          hash: '0xintent1',
          chainId: 1,
          params: {},
          transactionHash: '0xtx1',
          blockNumber: BigInt(100),
          blockTimestamp: BigInt(1000),
          evt_log_address: chainConfigs[0].portalAddresses[0],
          evt_log_index: 0,
          from: '0xfrom',
        },
        {
          hash: '0xintent2',
          chainId: 1,
          params: {},
          transactionHash: '0xtx2',
          blockNumber: BigInt(101),
          blockTimestamp: BigInt(2000),
          evt_log_address: chainConfigs[0].portalAddresses[0],
          evt_log_index: 0,
          from: '0xfrom',
        },
      ];

      mockIndexerService.queryPublishedIntents
        .mockReturnValueOnce(
          (async function* () {
            yield [mockIntents[0]];
          })(),
        )
        .mockReturnValueOnce(
          (async function* () {
            yield [mockIntents[1]];
          })(),
        );

      await indexListener.start();

      // First poll
      await new Promise((resolve) => setTimeout(resolve, 2100));

      // Second poll
      await new Promise((resolve) => setTimeout(resolve, 2100));

      const calls = mockIndexerService.queryPublishedIntents.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);
      // Second call should have timestamp from first event (minimum across all chains)
      expect(calls[1][0].since).toBe(BigInt(1000));
    });

    it('should handle errors gracefully', async () => {
      mockIndexerService.queryPublishedIntents.mockImplementation(() => {
        throw new Error('Network error');
      });

      await indexListener.start();
      await new Promise((resolve) => setTimeout(resolve, 2100));

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to fetch published intents',
        expect.any(Error),
      );
    });
  });

  describe('fetchFulfilledIntents', () => {
    it('should fetch and convert fulfilled intents to BlockchainEventJob', async () => {
      const mockFulfillment: IndexedFulfillment = {
        hash: '0xintent123',
        chainId: 1,
        transactionHash: '0xtx123',
        blockNumber: BigInt(100),
        blockTimestamp: BigInt(1000),
        evt_log_address: chainConfigs[0].portalAddresses[0],
        evt_log_index: 0,
      };

      mockIndexerService.queryFulfilledIntents.mockReturnValue(
        (async function* () {
          yield [mockFulfillment];
        })(),
      );

      await indexListener.start();
      await new Promise((resolve) => setTimeout(resolve, 5100));

      expect(mockQueueService.addBlockchainEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'IntentFulfilled',
          chainId: 1,
          chainType: 'evm',
          contractName: 'portal',
          intentHash: '0xintent123',
        }),
      );
    }, 10000);
  });

  describe('fetchWithdrawnIntents', () => {
    it('should fetch and convert withdrawn intents to BlockchainEventJob', async () => {
      const mockWithdrawal: IndexedWithdrawal = {
        hash: '0xintent123',
        chainId: 1,
        transactionHash: '0xtx123',
        blockNumber: BigInt(100),
        blockTimestamp: BigInt(1000),
        evt_log_address: chainConfigs[0].portalAddresses[0],
        evt_log_index: 0,
      };

      mockIndexerService.queryWithdrawnIntents.mockReturnValue(
        (async function* () {
          yield [mockWithdrawal];
        })(),
      );

      await indexListener.start();
      await new Promise((resolve) => setTimeout(resolve, 60100));

      expect(mockQueueService.addBlockchainEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'IntentWithdrawn',
          chainId: 1,
          chainType: 'evm',
          contractName: 'portal',
          intentHash: '0xintent123',
        }),
      );
    }, 65000);
  });

  describe('fetchFundedIntents', () => {
    it('should fetch and convert funded intents to BlockchainEventJob', async () => {
      const mockRefund: IndexedRefund = {
        hash: '0xintent123',
        chainId: 1,
        transactionHash: '0xtx123',
        blockNumber: BigInt(100),
        blockTimestamp: BigInt(1000),
        evt_log_address: chainConfigs[0].portalAddresses[0],
        evt_log_index: 0,
      };

      mockIndexerService.queryFundedIntents.mockReturnValue(
        (async function* () {
          yield [mockRefund];
        })(),
      );

      await indexListener.start();
      await new Promise((resolve) => setTimeout(resolve, 5100));

      expect(mockQueueService.addBlockchainEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'IntentFunded',
          chainId: 1,
          chainType: 'evm',
          contractName: 'portal',
          intentHash: '0xintent123',
        }),
      );
    }, 10000);
  });

  describe('processEvents', () => {
    it('should handle queue errors gracefully', async () => {
      mockQueueService.addBlockchainEvent.mockRejectedValue(new Error('Queue error'));

      const mockIntent: IndexedIntent = {
        hash: '0xintent123',
        chainId: 1,
        params: {},
        transactionHash: '0xtx123',
        blockNumber: BigInt(100),
        blockTimestamp: BigInt(1000),
        evt_log_address: chainConfigs[0].portalAddresses[0],
        evt_log_index: 0,
        from: '0xfrom',
      };

      mockIndexerService.queryPublishedIntents.mockReturnValue(
        (async function* () {
          yield [mockIntent];
        })(),
      );

      await indexListener.start();
      await new Promise((resolve) => setTimeout(resolve, 2100));

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to queue event'),
        expect.any(Error),
      );
    });
  });

  describe('timestamp tracking', () => {
    it('should track timestamps per chain-eventType pair', async () => {
      const mockIntentChain1: IndexedIntent = {
        hash: '0xintent1',
        chainId: 1,
        params: {},
        transactionHash: '0xtx1',
        blockNumber: BigInt(100),
        blockTimestamp: BigInt(1000),
        evt_log_address: chainConfigs[0].portalAddresses[0],
        evt_log_index: 0,
        from: '0xfrom',
      };

      const mockIntentChain10: IndexedIntent = {
        hash: '0xintent10',
        chainId: 10,
        params: {},
        transactionHash: '0xtx10',
        blockNumber: BigInt(200),
        blockTimestamp: BigInt(3000),
        evt_log_address: chainConfigs[1].portalAddresses[0],
        evt_log_index: 0,
        from: '0xfrom',
      };

      mockIndexerService.queryPublishedIntents
        .mockReturnValueOnce(
          (async function* () {
            yield [mockIntentChain1, mockIntentChain10];
          })(),
        )
        .mockReturnValueOnce(
          (async function* () {
            yield [];
          })(),
        );

      await indexListener.start();

      // First poll
      await new Promise((resolve) => setTimeout(resolve, 2100));

      // Second poll
      await new Promise((resolve) => setTimeout(resolve, 2100));

      const calls = mockIndexerService.queryPublishedIntents.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);
      // Second call should use minimum timestamp across all chains (1000 from chain 1)
      expect(calls[1][0].since).toBe(BigInt(1000));
    });
  });

  describe('event conversion', () => {
    it('should convert IndexedIntent to BlockchainEventJob with correct structure', async () => {
      const mockIntent: IndexedIntent = {
        hash: '0xintent123',
        chainId: 1,
        params: { test: 'data' },
        transactionHash: '0xtx123',
        blockNumber: BigInt(100),
        blockTimestamp: BigInt(1000),
        evt_log_address: chainConfigs[0].portalAddresses[0],
        evt_log_index: 5,
        from: '0xfrom',
      };

      mockIndexerService.queryPublishedIntents.mockReturnValue(
        (async function* () {
          yield [mockIntent];
        })(),
      );

      await indexListener.start();
      await new Promise((resolve) => setTimeout(resolve, 2100));

      expect(mockQueueService.addBlockchainEvent).toHaveBeenCalledWith({
        eventType: 'IntentPublished',
        chainId: 1,
        chainType: 'evm',
        contractName: 'portal',
        intentHash: '0xintent123',
        eventData: {
          args: { test: 'data' },
          transactionHash: '0xtx123',
          blockNumber: BigInt(100),
          logIndex: 5,
          address: chainConfigs[0].portalAddresses[0],
        },
        metadata: {
          txHash: '0xtx123',
          blockNumber: 100,
          logIndex: 5,
          contractAddress: chainConfigs[0].portalAddresses[0],
          timestamp: 1000,
        },
      });
    });
  });

  describe('multi-chain support', () => {
    it('should process events from all configured chains', async () => {
      const mockIntents: IndexedIntent[] = [
        {
          hash: '0xintent1',
          chainId: 1,
          params: {},
          transactionHash: '0xtx1',
          blockNumber: BigInt(100),
          blockTimestamp: BigInt(1000),
          evt_log_address: chainConfigs[0].portalAddresses[0],
          evt_log_index: 0,
          from: '0xfrom',
        },
        {
          hash: '0xintent10',
          chainId: 10,
          params: {},
          transactionHash: '0xtx10',
          blockNumber: BigInt(200),
          blockTimestamp: BigInt(2000),
          evt_log_address: chainConfigs[1].portalAddresses[0],
          evt_log_index: 0,
          from: '0xfrom',
        },
      ];

      mockIndexerService.queryPublishedIntents.mockReturnValue(
        (async function* () {
          yield mockIntents;
        })(),
      );

      await indexListener.start();
      await new Promise((resolve) => setTimeout(resolve, 2100));

      expect(mockQueueService.addBlockchainEvent).toHaveBeenCalledTimes(2);
    });

    it('should query with all portal addresses', async () => {
      mockIndexerService.queryPublishedIntents.mockReturnValue(
        (async function* () {
          yield [];
        })(),
      );

      await indexListener.start();
      await new Promise((resolve) => setTimeout(resolve, 2100));

      expect(mockIndexerService.queryPublishedIntents).toHaveBeenCalledWith({
        portalAddresses: allPortalAddresses,
        since: BigInt(0),
      });
    });
  });
});
