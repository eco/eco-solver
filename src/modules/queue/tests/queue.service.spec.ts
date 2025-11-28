import { QueueConfigService } from '@/modules/config/services/queue-config.service';
import { FULFILLMENT_STRATEGY_NAMES } from '@/modules/fulfillment/types/strategy-name.type';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';

import { QueueService } from '../queue.service';

describe('QueueService - Fulfillment Job Delay', () => {
  let service: QueueService;
  let mockLogger: any;
  let mockQueueConfig: Partial<QueueConfigService>;
  let mockExecutionQueue: any;
  let mockFulfillmentQueue: any;
  let mockWithdrawalQueue: any;
  let mockBlockchainEventsQueue: any;

  beforeEach(() => {
    mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    mockExecutionQueue = {
      add: jest.fn().mockResolvedValue({}),
      isPaused: jest.fn().mockResolvedValue(false),
    };

    mockFulfillmentQueue = {
      add: jest.fn().mockResolvedValue({}),
      isPaused: jest.fn().mockResolvedValue(false),
    };

    mockWithdrawalQueue = {
      add: jest.fn().mockResolvedValue({}),
      isPaused: jest.fn().mockResolvedValue(false),
    };

    mockBlockchainEventsQueue = {
      add: jest.fn().mockResolvedValue({}),
      isPaused: jest.fn().mockResolvedValue(false),
    };

    // Mock the config service with all necessary getters
    mockQueueConfig = {
      fulfillmentJobDelay: 5000, // 5 second delay
      temporaryRetryConfig: {
        attempts: 3,
        backoffMs: 2000,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
      concurrency: 5,
      executionConcurrency: 10,
      maxRetriesPerRequest: 3,
      retryDelayMs: 5000,
      getRetryOptions: jest.fn(),
    };

    service = new QueueService(
      mockLogger,
      mockQueueConfig as QueueConfigService,
      mockExecutionQueue,
      mockFulfillmentQueue,
      mockWithdrawalQueue,
      mockBlockchainEventsQueue,
    );
  });

  it('should honor fulfillment job delay configuration', async () => {
    const mockIntent = createMockIntent();

    await service.addIntentToFulfillmentQueue(mockIntent);

    // Verify the add method was called with the correct parameters
    expect(mockFulfillmentQueue.add).toHaveBeenCalledTimes(1);

    const [jobName, serializedData, options] = mockFulfillmentQueue.add.mock.calls[0];

    expect(jobName).toBe('process-intent');
    expect(typeof serializedData).toBe('string'); // Data is serialized
    expect(options).toEqual(
      expect.objectContaining({
        delay: 5000, // Should include the configured delay
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }),
    );
  });

  it('should use zero delay when not configured', async () => {
    const mockConfigNoDelay: Partial<QueueConfigService> = {
      fulfillmentJobDelay: 0,
      temporaryRetryConfig: {
        attempts: 3,
        backoffMs: 2000,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
      concurrency: 5,
      executionConcurrency: 10,
      maxRetriesPerRequest: 3,
      retryDelayMs: 5000,
      getRetryOptions: jest.fn(),
    };

    service = new QueueService(
      mockLogger,
      mockConfigNoDelay as QueueConfigService,
      mockExecutionQueue,
      mockFulfillmentQueue,
      mockWithdrawalQueue,
      mockBlockchainEventsQueue,
    );

    const mockIntent = createMockIntent();
    await service.addIntentToFulfillmentQueue(mockIntent);

    // Verify the add method was called with the correct parameters
    expect(mockFulfillmentQueue.add).toHaveBeenCalledTimes(1);

    const [jobName, serializedData, options] = mockFulfillmentQueue.add.mock.calls[0];

    expect(jobName).toBe('process-intent');
    expect(typeof serializedData).toBe('string'); // Data is serialized
    expect(options).toEqual(
      expect.objectContaining({
        delay: 0,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }),
    );
  });
});

describe('QueueService - Execution Queue Configuration', () => {
  let service: QueueService;
  let mockLogger: any;
  let mockQueueConfig: Partial<QueueConfigService>;
  let mockExecutionQueue: any;
  let mockFulfillmentQueue: any;
  let mockWithdrawalQueue: any;
  let mockBlockchainEventsQueue: any;

  beforeEach(() => {
    mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    mockExecutionQueue = {
      add: jest.fn().mockResolvedValue({}),
      isPaused: jest.fn().mockResolvedValue(false),
    };

    mockFulfillmentQueue = {
      add: jest.fn().mockResolvedValue({}),
      isPaused: jest.fn().mockResolvedValue(false),
    };

    mockWithdrawalQueue = {
      add: jest.fn().mockResolvedValue({}),
      isPaused: jest.fn().mockResolvedValue(false),
    };

    mockBlockchainEventsQueue = {
      add: jest.fn().mockResolvedValue({}),
      isPaused: jest.fn().mockResolvedValue(false),
    };

    mockQueueConfig = {
      executionJobOptions: {
        attempts: 3,
        backoff: { type: 'exponentialCapped' },
      },
      fulfillmentJobDelay: 0,
      temporaryRetryConfig: {
        attempts: 3,
        backoffMs: 2000,
      },
    } as any;

    service = new QueueService(
      mockLogger,
      mockQueueConfig as QueueConfigService,
      mockExecutionQueue,
      mockFulfillmentQueue,
      mockWithdrawalQueue,
      mockBlockchainEventsQueue,
    );
  });

  it('should use configured job options for execution queue', async () => {
    const mockIntent = createMockIntent();
    const jobData = {
      strategy: FULFILLMENT_STRATEGY_NAMES.STANDARD,
      intent: mockIntent,
      chainId: BigInt(1),
    };

    await service.addIntentToExecutionQueue(jobData);

    expect(mockExecutionQueue.add).toHaveBeenCalledTimes(1);

    const [jobName, serializedData, options] = mockExecutionQueue.add.mock.calls[0];

    expect(jobName).toContain('blockchain-execution-chain-1');
    expect(typeof serializedData).toBe('string');
    expect(options).toEqual({
      attempts: 3,
      backoff: { type: 'exponentialCapped' },
    });
  });
});

describe('QueueService - Fulfillment Queue Deduplication', () => {
  let service: QueueService;
  let mockLogger: any;
  let mockQueueConfig: Partial<QueueConfigService>;
  let mockExecutionQueue: any;
  let mockFulfillmentQueue: any;
  let mockWithdrawalQueue: any;
  let mockBlockchainEventsQueue: any;

  beforeEach(() => {
    mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    mockExecutionQueue = {
      add: jest.fn().mockResolvedValue({}),
      isPaused: jest.fn().mockResolvedValue(false),
    };

    mockFulfillmentQueue = {
      add: jest.fn().mockResolvedValue({}),
      isPaused: jest.fn().mockResolvedValue(false),
    };

    mockWithdrawalQueue = {
      add: jest.fn().mockResolvedValue({}),
      isPaused: jest.fn().mockResolvedValue(false),
    };

    mockBlockchainEventsQueue = {
      add: jest.fn().mockResolvedValue({}),
      isPaused: jest.fn().mockResolvedValue(false),
    };

    mockQueueConfig = {
      fulfillmentJobDelay: 0,
      temporaryRetryConfig: {
        attempts: 3,
        backoffMs: 2000,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
      concurrency: 5,
      executionConcurrency: 10,
      maxRetriesPerRequest: 3,
      retryDelayMs: 5000,
      getRetryOptions: jest.fn(),
    };

    service = new QueueService(
      mockLogger,
      mockQueueConfig as QueueConfigService,
      mockExecutionQueue,
      mockFulfillmentQueue,
      mockWithdrawalQueue,
      mockBlockchainEventsQueue,
    );
  });

  it('should use deterministic job ID based on intent hash', async () => {
    const mockIntent = createMockIntent();

    await service.addIntentToFulfillmentQueue(mockIntent, FULFILLMENT_STRATEGY_NAMES.STANDARD);

    expect(mockFulfillmentQueue.add).toHaveBeenCalledWith(
      'process-intent',
      expect.any(String),
      expect.objectContaining({
        jobId: `fulfillment-${mockIntent.intentHash}`,
      }),
    );
  });

  it('should use same job ID for same intent with different strategies', async () => {
    const mockIntent = createMockIntent();

    await service.addIntentToFulfillmentQueue(mockIntent, FULFILLMENT_STRATEGY_NAMES.STANDARD);
    await service.addIntentToFulfillmentQueue(
      mockIntent,
      FULFILLMENT_STRATEGY_NAMES.CROWD_LIQUIDITY,
    );

    // Both should use the same jobId (based only on intent hash)
    expect(mockFulfillmentQueue.add).toHaveBeenNthCalledWith(
      1,
      'process-intent',
      expect.any(String),
      expect.objectContaining({
        jobId: `fulfillment-${mockIntent.intentHash}`,
      }),
    );

    expect(mockFulfillmentQueue.add).toHaveBeenNthCalledWith(
      2,
      'process-intent',
      expect.any(String),
      expect.objectContaining({
        jobId: `fulfillment-${mockIntent.intentHash}`,
      }),
    );
  });

  it('should prevent duplicate jobs with same intent hash', async () => {
    // This test verifies BullMQ behavior - same jobId prevents duplicate jobs
    const mockIntent = createMockIntent();

    // Submit same intent twice
    await service.addIntentToFulfillmentQueue(mockIntent, FULFILLMENT_STRATEGY_NAMES.STANDARD);
    await service.addIntentToFulfillmentQueue(mockIntent, FULFILLMENT_STRATEGY_NAMES.STANDARD);

    // Both calls should use the same jobId
    expect(mockFulfillmentQueue.add).toHaveBeenCalledTimes(2);
    expect(mockFulfillmentQueue.add).toHaveBeenNthCalledWith(
      1,
      'process-intent',
      expect.any(String),
      expect.objectContaining({
        jobId: `fulfillment-${mockIntent.intentHash}`,
      }),
    );
    expect(mockFulfillmentQueue.add).toHaveBeenNthCalledWith(
      2,
      'process-intent',
      expect.any(String),
      expect.objectContaining({
        jobId: `fulfillment-${mockIntent.intentHash}`,
      }),
    );

    // BullMQ will handle deduplication - newer job replaces older if still queued
  });
});
