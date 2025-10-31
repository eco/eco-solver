import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { Job } from 'bullmq';

import { BigintSerializer } from '@/common/utils/bigint-serializer';
import { toError } from '@/common/utils/error-handler';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { QueueConfigService } from '@/modules/config/services/queue-config.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { BullMQOtelFactory } from '@/modules/opentelemetry/bullmq-otel.factory';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';
import { ExecutionJobData } from '@/modules/queue/interfaces/execution-job.interface';

@Processor(QueueNames.INTENT_EXECUTION, {
  prefix: `{${QueueNames.INTENT_EXECUTION}}`,
})
export class BlockchainProcessor extends WorkerHost implements OnModuleInit, OnModuleDestroy {
  private chainLocks: Map<string, Promise<void>> = new Map();
  constructor(
    private blockchainService: BlockchainExecutorService,
    @Inject(QueueConfigService) private queueConfig: QueueConfigService,
    private readonly logger: SystemLoggerService,
    @Inject(BullMQOtelFactory) private bullMQOtelFactory: BullMQOtelFactory,
    private readonly otelService: OpenTelemetryService,
  ) {
    super();
    this.logger.setContext(BlockchainProcessor.name);
  }

  onModuleInit() {
    // Set concurrency from configuration after worker is initialized
    if (this.worker) {
      this.worker.concurrency = this.queueConfig.executionConcurrency;

      // Add telemetry if available
      const telemetry = this.bullMQOtelFactory.getInstance();
      if (telemetry && !this.worker.opts.telemetry) {
        this.worker.opts.telemetry = telemetry;
        this.logger.log('Added BullMQOtel telemetry to BlockchainProcessor worker');
      }
    }
  }

  async onModuleDestroy() {
    // Close the worker to ensure clean shutdown
    if (this.worker) {
      this.logger.log('Closing BlockchainProcessor worker...');
      await this.worker.close();
      this.logger.log('BlockchainProcessor worker closed');
    }
  }

  async process(job: Job<string>) {
    const jobData = BigintSerializer.deserialize<ExecutionJobData>(job.data);
    const { intent, strategy, chainId, walletId } = jobData;
    const chainKey = chainId.toString();

    this.logger.log(
      `Processing intent ${intent.intentHash} for chain ${chainKey} with strategy ${strategy}`,
    );

    // Break context and start a new trace for execution stage
    return this.otelService.startNewTraceWithCorrelation(
      'execution.process',
      intent.intentHash,
      'execution',
      async (span) => {
        span.setAttributes({
          'execution.strategy': strategy,
          'execution.chain_id': chainKey,
          'execution.wallet_id': walletId || 'default',
          'intent.source_chain': intent.sourceChainId?.toString() || 'unknown',
          'intent.destination_chain': intent.destination.toString(),
        });

        // Ensure sequential processing per chain
        const currentLock = this.chainLocks.get(chainKey) || Promise.resolve();

        // Create a new lock for this chain
        const newLock = currentLock.then(async () => {
          try {
            this.logger.log(`Executing intent ${intent.intentHash} on chain ${chainKey}`);
            span.addEvent('execution.started');
            await this.blockchainService.executeIntent(intent, walletId);
            span.addEvent('execution.completed');
            this.logger.log(`Completed intent ${intent.intentHash} on chain ${chainKey}`);
          } catch (error) {
            this.logger.error(
              `Failed to execute intent ${intent.intentHash} on chain ${chainKey}:`,
              toError(error),
            );
            span.recordException(toError(error));
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
      },
      {
        'execution.job_id': job.id,
      },
    );
  }
}
