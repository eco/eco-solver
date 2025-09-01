import { Test, TestingModule } from '@nestjs/testing';

import { Job } from 'bullmq';
import { Address, Hex } from 'viem';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { toUniversalAddress, padTo32Bytes } from '@/common/types/universal-address.type';
import { QueueConfigService } from '@/modules/config/services/queue-config.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { ExecutionJobData } from '@/modules/queue/interfaces/execution-job.interface';
import { QueueSerializer } from '@/modules/queue/utils/queue-serializer';

import { BlockchainProcessor } from '../blockchain.processor';
import { BlockchainExecutorService } from '../blockchain-executor.service';

jest.mock('@/modules/queue/utils/queue-serializer');

// Helper to serialize objects with BigInt
const serializeWithBigInt = (obj: any) =>
  JSON.stringify(obj, (_, value) => (typeof value === 'bigint' ? value.toString() : value));

describe('BlockchainProcessor', () => {
  let processor: BlockchainProcessor;
  let blockchainService: jest.Mocked<BlockchainExecutorService>;
  let queueConfig: jest.Mocked<QueueConfigService>;
  let logger: jest.Mocked<any>;

  const mockIntent: Intent = {
    intentHash: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
    destination: 10n,
    sourceChainId: 1n,
    reward: {
      prover: toUniversalAddress(padTo32Bytes('0x1234567890123456789012345678901234567890')),
      creator: toUniversalAddress(padTo32Bytes('0x0987654321098765432109876543210987654321')),
      deadline: 1234567890n,
      nativeAmount: 1000000000000000000n,
      tokens: [],
    },
    route: {
      salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
      deadline: 1234567890n,
      portal: toUniversalAddress(padTo32Bytes('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')),
      nativeAmount: 1000000000000000000n,
      calls: [],
      tokens: [],
    },
    status: IntentStatus.PENDING,
  };

  const mockJobData: ExecutionJobData = {
    intent: mockIntent,
    strategy: 'standard',
    chainId: 10n,
    walletId: 'basic',
  };

  beforeEach(async () => {
    blockchainService = {
      executeIntent: jest.fn().mockResolvedValue(undefined),
    } as any;

    queueConfig = {
      executionConcurrency: 5,
    } as any;

    logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainProcessor,
        { provide: BlockchainExecutorService, useValue: blockchainService },
        { provide: QueueConfigService, useValue: queueConfig },
        { provide: SystemLoggerService, useValue: logger },
      ],
    }).compile();

    processor = module.get<BlockchainProcessor>(BlockchainProcessor);

    // Mock QueueSerializer to return the mock data directly
    (QueueSerializer.deserialize as jest.Mock).mockReturnValue(mockJobData);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should set worker concurrency from configuration', () => {
      // Mock the worker getter
      const mockWorker = { concurrency: 0 };
      Object.defineProperty(processor, 'worker', {
        get: jest.fn(() => mockWorker),
        configurable: true,
      });

      processor.onModuleInit();

      expect(mockWorker.concurrency).toBe(5);
    });

    it('should handle missing worker gracefully', () => {
      // Mock the worker getter to return undefined
      Object.defineProperty(processor, 'worker', {
        get: jest.fn(() => undefined),
        configurable: true,
      });

      expect(() => processor.onModuleInit()).not.toThrow();
    });
  });

  describe('process', () => {
    it('should process job successfully', async () => {
      const mockJob: Job<string> = {
        data: serializeWithBigInt(mockJobData),
      } as any;

      await processor.process(mockJob);

      expect(QueueSerializer.deserialize).toHaveBeenCalledWith(mockJob.data);
      expect(blockchainService.executeIntent).toHaveBeenCalledWith(mockIntent, 'basic');
    });

    it('should handle job without walletId', async () => {
      const jobDataWithoutWallet = { ...mockJobData, walletId: undefined };
      const mockJob: Job<string> = {
        data: serializeWithBigInt(jobDataWithoutWallet),
      } as any;

      (QueueSerializer.deserialize as jest.Mock).mockReturnValueOnce(jobDataWithoutWallet);

      await processor.process(mockJob);

      expect(blockchainService.executeIntent).toHaveBeenCalledWith(mockIntent, undefined);
    });

    it('should handle execution errors', async () => {
      const mockJob: Job<string> = {
        data: serializeWithBigInt(mockJobData),
      } as any;

      const error = new Error('Execution failed');
      blockchainService.executeIntent.mockRejectedValue(error);

      await expect(processor.process(mockJob)).rejects.toThrow(error);
      expect(blockchainService.executeIntent).toHaveBeenCalledWith(mockIntent, 'basic');
    });

    it('should ensure sequential processing per chain', async () => {
      const jobData1 = { ...mockJobData, intent: { ...mockIntent, intentHash: '0xhash1' as Hex } };
      const jobData2 = { ...mockJobData, intent: { ...mockIntent, intentHash: '0xhash2' as Hex } };
      const jobData3 = { ...mockJobData, intent: { ...mockIntent, intentHash: '0xhash3' as Hex } };

      const job1: Job<string> = { data: serializeWithBigInt(jobData1) } as any;
      const job2: Job<string> = { data: serializeWithBigInt(jobData2) } as any;
      const job3: Job<string> = { data: serializeWithBigInt(jobData3) } as any;

      // Mock deserializer to return correct data for each job
      (QueueSerializer.deserialize as jest.Mock)
        .mockReturnValueOnce(jobData1)
        .mockReturnValueOnce(jobData2)
        .mockReturnValueOnce(jobData3);

      // Add delay to simulate async execution
      const executionOrder: string[] = [];
      blockchainService.executeIntent.mockImplementation(async (intent) => {
        executionOrder.push(intent.intentHash);
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Start all jobs concurrently
      const promises = [processor.process(job1), processor.process(job2), processor.process(job3)];

      await Promise.all(promises);

      // Verify sequential execution for same chain
      expect(executionOrder).toEqual(['0xhash1', '0xhash2', '0xhash3']);
      expect(blockchainService.executeIntent).toHaveBeenCalledTimes(3);
    });

    it('should allow parallel processing for different chains', async () => {
      const jobData1 = {
        ...mockJobData,
        chainId: 1n,
        intent: { ...mockIntent, intentHash: '0xhash1' as Hex },
      };
      const jobData2 = {
        ...mockJobData,
        chainId: 10n,
        intent: { ...mockIntent, intentHash: '0xhash2' as Hex },
      };
      const jobData3 = {
        ...mockJobData,
        chainId: 137n,
        intent: { ...mockIntent, intentHash: '0xhash3' as Hex },
      };

      const job1: Job<string> = { data: serializeWithBigInt(jobData1) } as any;
      const job2: Job<string> = { data: serializeWithBigInt(jobData2) } as any;
      const job3: Job<string> = { data: serializeWithBigInt(jobData3) } as any;

      // Mock deserializer to return correct data for each job
      (QueueSerializer.deserialize as jest.Mock)
        .mockReturnValueOnce(jobData1)
        .mockReturnValueOnce(jobData2)
        .mockReturnValueOnce(jobData3);

      // Track execution timing
      const executionTimes: Record<string, number> = {};
      const startTime = Date.now();

      blockchainService.executeIntent.mockImplementation(async (intent) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        executionTimes[intent.intentHash] = Date.now() - startTime;
      });

      // Start all jobs concurrently
      await Promise.all([
        processor.process(job1),
        processor.process(job2),
        processor.process(job3),
      ]);

      // Verify all jobs completed around the same time (parallel execution)
      const times = Object.values(executionTimes);
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      // If executed in parallel, the difference should be small
      expect(maxTime - minTime).toBeLessThan(30);
      expect(blockchainService.executeIntent).toHaveBeenCalledTimes(3);
    });

    it('should clean up chain locks after completion', async () => {
      const mockJob: Job<string> = {
        data: serializeWithBigInt(mockJobData),
      } as any;

      await processor.process(mockJob);

      // Access private property for testing
      const chainLocks = (processor as any).chainLocks as Map<string, Promise<void>>;
      expect(chainLocks.size).toBe(0);
    });

    it('should handle bigint chainId', async () => {
      const jobDataWithBigInt = { ...mockJobData, chainId: 10n };
      const mockJob: Job<string> = {
        data: serializeWithBigInt(jobDataWithBigInt),
      } as any;

      (QueueSerializer.deserialize as jest.Mock).mockReturnValueOnce(jobDataWithBigInt);

      await processor.process(mockJob);

      expect(blockchainService.executeIntent).toHaveBeenCalledWith(mockIntent, 'basic');
    });
  });
});
