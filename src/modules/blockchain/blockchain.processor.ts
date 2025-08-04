import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, OnModuleInit } from '@nestjs/common';

import { Job } from 'bullmq';

import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { QueueConfigService } from '@/modules/config/services/queue-config.service';
import { ExecutionJobData } from '@/modules/queue/interfaces/execution-job.interface';

@Processor('blockchain-execution', {
  concurrency: 10, // Will be overridden by constructor
})
export class BlockchainProcessor extends WorkerHost implements OnModuleInit {
  private chainLocks: Map<string, Promise<void>> = new Map();
  constructor(
    private blockchainService: BlockchainExecutorService,
    @Inject(QueueConfigService) private queueConfig: QueueConfigService,
  ) {
    super();
  }

  onModuleInit() {
    // Set concurrency from configuration after worker is initialized
    if (this.worker) {
      this.worker.concurrency = this.queueConfig.executionConcurrency;
    }
  }

  async process(job: Job<ExecutionJobData>) {
    const { intent, strategy, chainId } = job.data;
    const chainKey = chainId.toString();

    console.log(
      `Processing intent ${intent.intentHash} for chain ${chainKey} with strategy ${strategy}`,
    );

    // Ensure sequential processing per chain
    const currentLock = this.chainLocks.get(chainKey) || Promise.resolve();

    // Create new lock for this chain
    const newLock = currentLock.then(async () => {
      try {
        console.log(`Executing intent ${intent.intentHash} on chain ${chainKey}`);
        await this.blockchainService.executeIntent(intent);
        console.log(`Completed intent ${intent.intentHash} on chain ${chainKey}`);
      } catch (error) {
        console.error(`Failed to execute intent ${intent.intentHash} on chain ${chainKey}:`, error);
        throw error;
      }
    });

    // Update the lock for this chain
    this.chainLocks.set(chainKey, newLock);

    // Wait for execution to complete
    await newLock;

    // Clean up completed locks to prevent memory leaks
    if (this.chainLocks.get(chainKey) === newLock) {
      this.chainLocks.delete(chainKey);
    }
  }
}
