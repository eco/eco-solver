import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { Span } from '@opentelemetry/api';
import { Job } from 'bullmq';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { BigintSerializer } from '@/common/utils/bigint-serializer';
import { toError } from '@/common/utils/error-handler';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { EvmExecutorService } from '@/modules/blockchain/evm/services/evm.executor.service';
import { QueueConfigService } from '@/modules/config/services/queue-config.service';
import { IntentsService } from '@/modules/intents/intents.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { BullMQOtelFactory } from '@/modules/opentelemetry/bullmq-otel.factory';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';
import {
  ExecutionJobData,
  RhinestoneClaimJob,
  RhinestoneFillJob,
  RhinestoneProveJob,
  StandardExecutionJob,
} from '@/modules/queue/interfaces/execution-job.interface';
import { QueueService } from '@/modules/queue/queue.service';
import { createExponentialCappedStrategy } from '@/modules/queue/utils/backoff-strategies';

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
    private readonly intentsService: IntentsService,
    private readonly queueService: QueueService,
  ) {
    super();
    this.logger.setContext(BlockchainProcessor.name);
  }

  onModuleInit() {
    // Set concurrency from configuration after worker is initialized
    if (this.worker) {
      this.worker.concurrency = this.queueConfig.executionConcurrency;

      // Configure exponentialCapped backoff strategy if enabled
      const backoffConfig = this.queueConfig.executionBackoffConfig;
      if (backoffConfig.useCustomBackoff && this.worker.opts) {
        if (!this.worker.opts.settings) {
          this.worker.opts.settings = {};
        }

        // Apply the exponentialCapped strategy
        this.worker.opts.settings.backoffStrategy = createExponentialCappedStrategy(
          this.queueConfig,
          this.logger,
        );

        this.logger.log(
          `Configured exponentialCapped backoff strategy: delay=${backoffConfig.backoffDelay}ms, ` +
            `maxDelay=${backoffConfig.backoffMaxDelay}ms, jitter=${backoffConfig.backoffJitter}`,
        );
      }

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

  @OnWorkerEvent('failed')
  async handleFailedJob(job: Job<string> | undefined, _error: Error) {
    if (!job) {
      return;
    }

    try {
      const jobData = BigintSerializer.deserialize<ExecutionJobData>(job.data);
      const intentHashes = this.getIntentHashesFromJob(jobData);

      this.logger.error(
        `Job ${job.id} of type ${jobData.type} failed after ${job.attemptsMade} attempts. Marking ${intentHashes.length} intent(s) as FAILED.`,
      );

      // Update all intent statuses to FAILED after all retries exhausted
      await Promise.all(
        intentHashes.map((intentHash) =>
          this.intentsService.updateStatus(intentHash, IntentStatus.FAILED),
        ),
      );
    } catch (err) {
      this.logger.error('Error handling failed job:', toError(err));
    }
  }

  async process(job: Job<string>) {
    const jobData = BigintSerializer.deserialize<ExecutionJobData>(job.data);

    this.logger.log(`Processing job ${job.id} of type: ${jobData.type}`);

    // Break context and start new trace
    return this.otelService.startNewTraceWithCorrelation(
      'execution.process',
      this.getIntentHashesFromJob(jobData).join(','),
      'execution',
      async (span) => {
        span.setAttribute('execution.job_type', jobData.type);

        // Ensure sequential processing per chain
        const chainKey = jobData.chainId.toString();
        const currentLock = this.chainLocks.get(chainKey) || Promise.resolve();

        const newLock = currentLock.then(async () => {
          try {
            // Type-safe routing using discriminated union
            switch (jobData.type) {
              case 'standard':
                return this.executeStandard(jobData, span);

              case 'rhinestone-claim':
                return this.executeRhinestoneClaim(jobData, span);

              case 'rhinestone-fill':
                return this.executeRhinestoneFill(jobData, job, span);

              case 'rhinestone-prove':
                return this.executeRhinestoneProve(jobData, span);
            }
          } catch (error) {
            this.logger.error(`Failed to execute job ${job.id}:`, toError(error));
            span.recordException(toError(error));
            throw error;
          }
        });

        this.chainLocks.set(chainKey, newLock);

        try {
          await newLock;
        } finally {
          if (this.chainLocks.get(chainKey) === newLock) {
            this.chainLocks.delete(chainKey);
          }
        }
      },
      { 'execution.job_id': job.id },
    );
  }

  private getIntentHashesFromJob(jobData: ExecutionJobData): string[] {
    switch (jobData.type) {
      case 'standard':
        return [jobData.intent.intentHash];
      case 'rhinestone-claim':
        return [jobData.intentHash];
      case 'rhinestone-prove':
        return [jobData.intent.intentHash];
      case 'rhinestone-fill':
        return jobData.intents.map((i) => i.intentHash);
    }
  }

  private async executeStandard(jobData: StandardExecutionJob, span: Span): Promise<void> {
    const { intent, strategy, walletId } = jobData;

    span.setAttributes({
      'execution.type': 'standard',
      'execution.strategy': strategy,
    });

    this.logger.log(`Executing standard intent ${intent.intentHash}`);

    await this.blockchainService.executeIntent(intent, walletId);

    this.logger.log(`Completed standard intent ${intent.intentHash}`);
  }

  private async executeRhinestoneClaim(jobData: RhinestoneClaimJob, span: Span): Promise<void> {
    const { intentHash, chainId, transaction, walletId } = jobData;

    span.setAttributes({
      'execution.type': 'rhinestone-claim',
      'rhinestone.intent_hash': intentHash,
      'rhinestone.source_chain': chainId.toString(),
    });

    this.logger.log(`Rhinestone CLAIM: ${intentHash} on chain ${chainId}`);

    const executor = this.blockchainService.getExecutorForChain(chainId);
    if (!(executor instanceof EvmExecutorService)) {
      throw new Error(
        `Rhinestone claim requires EVM executor, but got ${executor.constructor.name} for chain ${chainId}`,
      );
    }

    const txHash = await executor.executeRhinestoneClaim(
      Number(chainId),
      transaction.to,
      transaction.data,
      transaction.value,
      walletId || 'basic',
    );

    span.setAttribute('rhinestone.claim_tx', txHash);
    this.logger.log(`Rhinestone CLAIM confirmed: ${txHash}`);

    await this.intentsService.updateStatus(intentHash, IntentStatus.EXECUTING);
  }

  private async executeRhinestoneFill(
    jobData: RhinestoneFillJob,
    job: Job,
    span: Span,
  ): Promise<void> {
    const { intents, chainId, transaction, requiredApprovals, walletId, messageId } = jobData;

    span.setAttributes({
      'execution.type': 'rhinestone-fill',
      'rhinestone.intent_count': intents.length,
      'rhinestone.destination_chain': chainId.toString(),
    });

    const intentHashes = intents.map((i) => i.intentHash);
    this.logger.log(`Rhinestone FILL: ${intents.length} intents on chain ${chainId}`);

    const executor = this.blockchainService.getExecutorForChain(chainId);
    if (!(executor instanceof EvmExecutorService)) {
      throw new Error(
        `Rhinestone fill requires EVM executor, but got ${executor.constructor.name} for chain ${chainId}`,
      );
    }

    const txHash = await executor.executeRhinestoneFill(
      Number(chainId),
      requiredApprovals,
      transaction.to,
      transaction.data,
      transaction.value,
      walletId || 'basic',
      messageId,
    );

    span.setAttribute('rhinestone.fill_tx', txHash);
    this.logger.log(`Rhinestone FILL confirmed: ${txHash}`);

    await Promise.all(
      intentHashes.map((hash) => this.intentsService.updateStatus(hash, IntentStatus.FULFILLED)),
    );

    this.logger.log('Queueing prove jobs after fill confirmation');
    await this.queueService.addRhinestoneProveJobs({
      intents,
      chainId,
      walletId,
      messageId,
    });
  }

  private async executeRhinestoneProve(jobData: RhinestoneProveJob, span: Span): Promise<void> {
    const { intent, chainId, walletId } = jobData;

    span.setAttributes({
      'execution.type': 'rhinestone-prove',
      'rhinestone.intent_hash': intent.intentHash,
      'rhinestone.destination_chain': chainId.toString(),
    });

    this.logger.log(`Rhinestone PROVE: ${intent.intentHash} on chain ${chainId}`);

    const executor = this.blockchainService.getExecutorForChain(chainId);
    if (!(executor instanceof EvmExecutorService)) {
      throw new Error(
        `Rhinestone prove requires EVM executor, but got ${executor.constructor.name} for chain ${chainId}`,
      );
    }

    const { txHash, receipt } = await executor.executeRhinestoneProve(
      Number(chainId),
      intent as unknown as Intent,
      walletId || 'basic',
    );

    span.setAttribute('rhinestone.prove_tx', txHash);
    this.logger.log(`Rhinestone PROVE complete: ${txHash}`);

    // Get claimant address for SOURCE chain (where withdrawal will happen)
    const sourceChainId = intent.sourceChainId;
    const sourceExecutor = this.blockchainService.getExecutorForChain(sourceChainId);
    if (!(sourceExecutor instanceof EvmExecutorService)) {
      throw new Error(`Cannot get claimant address: source chain ${sourceChainId} is not EVM`);
    }

    const claimantUniversalAddress = await sourceExecutor.getWalletAddress(
      walletId || 'basic',
      sourceChainId,
    );
    const claimantAddress = AddressNormalizer.denormalizeToEvm(claimantUniversalAddress);

    await this.intentsService.updateProvenEvent({
      intentHash: intent.intentHash as `0x${string}`,
      claimant: AddressNormalizer.normalizeEvm(claimantAddress),
      transactionHash: txHash,
      blockNumber: receipt.blockNumber,
      timestamp: new Date(),
      chainId,
    });
  }
}
