import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, OnModuleInit, Optional } from '@nestjs/common';

import { Job } from 'bullmq';

import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { QueueConfigService } from '@/modules/config/services/queue-config.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { QueueTracingService } from '@/modules/opentelemetry/queue-tracing.service';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';
import { ExecutionJobData } from '@/modules/queue/interfaces/execution-job.interface';
import { QueueSerializer } from '@/modules/queue/utils/queue-serializer';

@Processor(QueueNames.INTENT_EXECUTION, {
  concurrency: 10, // Will be overridden by constructor
})
export class BlockchainProcessor extends WorkerHost implements OnModuleInit {
  private chainLocks: Map<string, Promise<void>> = new Map();
  constructor(
    private blockchainService: BlockchainExecutorService,
    @Inject(QueueConfigService) private queueConfig: QueueConfigService,
    private readonly logger: SystemLoggerService,
    @Optional() private readonly queueTracing?: QueueTracingService,
  ) {
    super();
    this.logger.setContext(BlockchainProcessor.name);
  }

  onModuleInit() {
    // Set concurrency from configuration after worker is initialized
    if (this.worker) {
      this.worker.concurrency = this.queueConfig.executionConcurrency;
    }
  }

  async process(job: Job<string>) {
    const processFn = async (j: Job<string>) => {
      const jobData = QueueSerializer.deserialize<ExecutionJobData>(j.data);
      const { intent, strategy, chainId, walletId } = jobData;
      const chainKey = chainId.toString();

      this.logger.log(
        `Processing intent ${intent.intentId} for chain ${chainKey} with strategy ${strategy}`,
      );

      // Ensure sequential processing per chain
      const currentLock = this.chainLocks.get(chainKey) || Promise.resolve();

      // Create a new lock for this chain
      const newLock = currentLock.then(async () => {
        try {
          this.logger.log(`Executing intent ${intent.intentId} on chain ${chainKey}`);
          await this.blockchainService.executeIntent(intent, walletId);
          this.logger.log(`Completed intent ${intent.intentId} on chain ${chainKey}`);
        } catch (error) {
          this.logger.error(
            `Failed to execute intent ${intent.intentId} on chain ${chainKey}:`,
            error,
          );
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
    };

    if (this.queueTracing) {
      return this.queueTracing.wrapProcessor(
        'BlockchainProcessor',
        QueueNames.INTENT_EXECUTION,
        processFn,
      )(job);
    } else {
      return processFn(job);
    }
  }
}
