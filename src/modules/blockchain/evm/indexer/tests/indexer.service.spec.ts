import { Test, TestingModule } from '@nestjs/testing';

import { SystemLoggerService } from '@/modules/logging';

import { IndexerService } from '../indexer.service';
import { IndexerConfigService } from '../indexer-config.service';
import type { IndexedFulfillment, IndexedIntent } from '../types/intent.types';

// Mock graphql-request
const mockRequest = jest.fn();
jest.mock('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: mockRequest,
  })),
  gql: (strings: TemplateStringsArray) => strings[0],
}));

describe('IndexerService', () => {
  let service: IndexerService;
  let configService: jest.Mocked<IndexerConfigService>;
  let logger: jest.Mocked<SystemLoggerService>;

  const mockIndexerUrl = 'https://indexer.eco.com/';
  const mockPortalAddresses = ['0x1234567890123456789012345678901234567890'];

  beforeEach(async () => {
    configService = {
      url: mockIndexerUrl,
      isConfigured: jest.fn().mockReturnValue(true),
    } as any;

    logger = {
      setContext: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndexerService,
        { provide: IndexerConfigService, useValue: configService },
        { provide: SystemLoggerService, useValue: logger },
      ],
    }).compile();

    service = module.get<IndexerService>(IndexerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should set logger context', () => {
    expect(logger.setContext).toHaveBeenCalledWith('IndexerService');
  });

  describe('queryPublishedIntents', () => {
    const mockIntent: IndexedIntent = {
      hash: '0xintent1',
      chainId: 1,
      params: {},
      transactionHash: '0xtx1',
      blockNumber: BigInt(100),
      blockTimestamp: BigInt(1000),
      evt_log_address: '0xportal',
      evt_log_index: 0,
      from: '0xfrom',
    };

    it('should fetch single page when hasNextPage is false', async () => {
      mockRequest.mockResolvedValueOnce({
        intents: {
          items: [mockIntent],
          totalCount: 1,
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        },
      });

      const results: IndexedIntent[] = [];
      for await (const batch of service.queryPublishedIntents({
        portalAddresses: mockPortalAddresses,
        since: BigInt(0),
      })) {
        results.push(...batch);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(mockIntent);
      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          portalAddresses: mockPortalAddresses,
          since: '0', // BigInt converted to string
          after: undefined,
        }),
      );
    });

    it('should fetch multiple pages when hasNextPage is true', async () => {
      const mockIntent2: IndexedIntent = { ...mockIntent, hash: '0xintent2' };

      mockRequest
        .mockResolvedValueOnce({
          intents: {
            items: [mockIntent],
            totalCount: 2,
            pageInfo: {
              hasNextPage: true,
              endCursor: 'cursor1',
            },
          },
        })
        .mockResolvedValueOnce({
          intents: {
            items: [mockIntent2],
            totalCount: 2,
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          },
        });

      const results: IndexedIntent[] = [];
      for await (const batch of service.queryPublishedIntents({
        portalAddresses: mockPortalAddresses,
        since: BigInt(0),
      })) {
        results.push(...batch);
      }

      expect(results).toHaveLength(2);
      expect(mockRequest).toHaveBeenCalledTimes(2);

      // First call - no cursor
      expect(mockRequest).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        expect.objectContaining({
          portalAddresses: mockPortalAddresses,
          since: '0',
          after: undefined,
        }),
      );

      // Second call - with cursor
      expect(mockRequest).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({
          portalAddresses: mockPortalAddresses,
          since: '0',
          after: 'cursor1',
        }),
      );
    });

    it('should handle empty results', async () => {
      mockRequest.mockResolvedValueOnce({
        intents: {
          items: [],
          totalCount: 0,
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        },
      });

      const results: IndexedIntent[] = [];
      for await (const batch of service.queryPublishedIntents({
        portalAddresses: mockPortalAddresses,
        since: BigInt(0),
      })) {
        results.push(...batch);
      }

      expect(results).toHaveLength(0);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should convert BigInt to string for GraphQL', async () => {
      mockRequest.mockResolvedValueOnce({
        intents: {
          items: [],
          totalCount: 0,
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      });

      const largeBigInt = BigInt('999999999999999999');

      for await (const _batch of service.queryPublishedIntents({
        portalAddresses: mockPortalAddresses,
        since: largeBigInt,
      })) {
        // Just iterate
      }

      expect(mockRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          since: '999999999999999999', // Converted to string
        }),
      );
    });

    it('should throw error on GraphQL failure', async () => {
      const mockError = new Error('GraphQL error');
      mockRequest.mockRejectedValueOnce(mockError);

      const generator = service.queryPublishedIntents({
        portalAddresses: mockPortalAddresses,
        since: BigInt(0),
      });

      await expect(generator.next()).rejects.toThrow(mockError);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should log debug messages during pagination', async () => {
      mockRequest.mockResolvedValueOnce({
        intents: {
          items: [mockIntent],
          totalCount: 1,
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        },
      });

      for await (const _batch of service.queryPublishedIntents({
        portalAddresses: mockPortalAddresses,
        since: BigInt(0),
      })) {
        // Just iterate
      }

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Fetched 1 published intents'),
      );
    });
  });

  describe('queryFulfilledIntents', () => {
    const mockFulfillment: IndexedFulfillment = {
      hash: '0xintent1',
      chainId: 1,
      transactionHash: '0xtx1',
      blockNumber: BigInt(100),
      blockTimestamp: BigInt(1000),
      evt_log_address: '0xportal',
      evt_log_index: 0,
    };

    it('should fetch fulfilled intents with pagination', async () => {
      mockRequest.mockResolvedValueOnce({
        fulfillments: {
          items: [mockFulfillment],
          totalCount: 1,
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        },
      });

      const results: IndexedFulfillment[] = [];
      for await (const batch of service.queryFulfilledIntents({
        portalAddresses: mockPortalAddresses,
        since: BigInt(0),
      })) {
        results.push(...batch);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(mockFulfillment);
    });

    it('should convert BigInt to string', async () => {
      mockRequest.mockResolvedValueOnce({
        fulfillments: {
          items: [],
          totalCount: 0,
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      });

      for await (const _batch of service.queryFulfilledIntents({
        portalAddresses: mockPortalAddresses,
        since: BigInt(12345),
      })) {
        // Just iterate
      }

      expect(mockRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          since: '12345',
        }),
      );
    });
  });

  describe('queryWithdrawnIntents', () => {
    it('should fetch withdrawn intents', async () => {
      const mockWithdrawal = {
        hash: '0xintent1',
        chainId: 1,
        transactionHash: '0xtx1',
        blockNumber: BigInt(100),
        blockTimestamp: BigInt(1000),
        evt_log_address: '0xportal',
        evt_log_index: 0,
      };

      mockRequest.mockResolvedValueOnce({
        withdrawals: {
          items: [mockWithdrawal],
          totalCount: 1,
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        },
      });

      const results = [];
      for await (const batch of service.queryWithdrawnIntents({
        portalAddresses: mockPortalAddresses,
        since: BigInt(0),
      })) {
        results.push(...batch);
      }

      expect(results).toHaveLength(1);
    });
  });

  describe('queryFundedIntents', () => {
    it('should fetch funded intents (refunds)', async () => {
      const mockRefund = {
        hash: '0xintent1',
        chainId: 1,
        transactionHash: '0xtx1',
        blockNumber: BigInt(100),
        blockTimestamp: BigInt(1000),
        evt_log_address: '0xportal',
        evt_log_index: 0,
      };

      mockRequest.mockResolvedValueOnce({
        refunds: {
          items: [mockRefund],
          totalCount: 1,
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        },
      });

      const results = [];
      for await (const batch of service.queryFundedIntents({
        portalAddresses: mockPortalAddresses,
        since: BigInt(0),
      })) {
        results.push(...batch);
      }

      expect(results).toHaveLength(1);
    });
  });
});
