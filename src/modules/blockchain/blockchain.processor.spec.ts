import { Test, TestingModule } from '@nestjs/testing';

import { Job } from 'bullmq';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { QueueConfigService } from '@/modules/config/services/queue-config.service';
import { ExecutionJobData } from '@/modules/queue/interfaces/execution-job.interface';

import { BlockchainExecutorService } from './blockchain-executor.service';
import { BlockchainProcessor } from './blockchain.processor';

describe('BlockchainProcessor', () => {
  let processor: BlockchainProcessor;
  let blockchainService: jest.Mocked<BlockchainExecutorService>;
  let queueConfig: jest.Mocked<QueueConfigService>;

  const createMockIntent = (intentHash: string, chainId: bigint): Intent => ({
    intentHash,
    intentId: intentHash,
    sourceChainId: 1n,
    createdAt: new Date(),
    status: IntentStatus.PENDING,
    reward: {
      prover: '0x0000000000000000000000000000000000000001' as any,
      creator: '0x0000000000000000000000000000000000000002' as any,
      deadline: 1000000000n,
      nativeValue: 0n,
      tokens: [],
    },
    route: {
      source: 1n,
      destination: chainId,
      salt: '0x0000000000000000000000000000000000000000000000000000000000000000' as any,
      inbox: '0x0000000000000000000000000000000000000003' as any,
      calls: [],
      tokens: [],
    },
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainProcessor,
        {
          provide: BlockchainExecutorService,
          useValue: {
            executeIntent: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: QueueConfigService,
          useValue: {
            executionConcurrency: 10,
          },
        },
      ],
    }).compile();

    processor = module.get<BlockchainProcessor>(BlockchainProcessor);
    blockchainService = module.get(BlockchainExecutorService);
    queueConfig = module.get(QueueConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should process jobs with different chain IDs in parallel', async () => {
    const intent1 = createMockIntent('intent1', 1n);
    const intent2 = createMockIntent('intent2', 10n);
    const intent3 = createMockIntent('intent3', 137n);

    const job1: Job<ExecutionJobData> = {
      data: { intent: intent1, strategy: 'standard', chainId: 1n },
    } as any;
    const job2: Job<ExecutionJobData> = {
      data: { intent: intent2, strategy: 'standard', chainId: 10n },
    } as any;
    const job3: Job<ExecutionJobData> = {
      data: { intent: intent3, strategy: 'standard', chainId: 137n },
    } as any;

    // Process jobs in parallel
    const results = await Promise.all([
      processor.process(job1),
      processor.process(job2),
      processor.process(job3),
    ]);

    // All jobs should complete
    expect(results).toHaveLength(3);

    // Each intent should be executed exactly once
    expect(blockchainService.executeIntent).toHaveBeenCalledTimes(3);
    expect(blockchainService.executeIntent).toHaveBeenCalledWith(intent1);
    expect(blockchainService.executeIntent).toHaveBeenCalledWith(intent2);
    expect(blockchainService.executeIntent).toHaveBeenCalledWith(intent3);
  });

  it('should process jobs for the same chain sequentially', async () => {
    const intent1 = createMockIntent('intent1', 1n);
    const intent2 = createMockIntent('intent2', 1n);
    const intent3 = createMockIntent('intent3', 1n);

    const executionOrder: string[] = [];
    blockchainService.executeIntent.mockImplementation(async (intent: Intent) => {
      executionOrder.push(intent.intentHash);
      // Add delay to ensure sequential processing is detectable
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const job1: Job<ExecutionJobData> = {
      data: { intent: intent1, strategy: 'standard', chainId: 1n },
    } as any;
    const job2: Job<ExecutionJobData> = {
      data: { intent: intent2, strategy: 'standard', chainId: 1n },
    } as any;
    const job3: Job<ExecutionJobData> = {
      data: { intent: intent3, strategy: 'standard', chainId: 1n },
    } as any;

    // Process jobs in parallel (but they should execute sequentially for same chain)
    await Promise.all([processor.process(job1), processor.process(job2), processor.process(job3)]);

    // Jobs should be executed in order for the same chain
    expect(executionOrder).toEqual(['intent1', 'intent2', 'intent3']);
    expect(blockchainService.executeIntent).toHaveBeenCalledTimes(3);
  });

  it('should handle errors gracefully', async () => {
    const intent = createMockIntent('intent1', 1n);
    const error = new Error('Execution failed');

    blockchainService.executeIntent.mockRejectedValue(error);

    const job: Job<ExecutionJobData> = {
      data: { intent, strategy: 'standard', chainId: 1n },
    } as any;

    // Process should throw the error
    await expect(processor.process(job)).rejects.toThrow('Execution failed');
    expect(blockchainService.executeIntent).toHaveBeenCalledWith(intent);
  });
});