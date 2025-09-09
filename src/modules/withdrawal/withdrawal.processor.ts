import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, OnModuleInit, Optional } from '@nestjs/common';

import { Job, Queue } from 'bullmq';

import { BigintSerializer } from '@/common/utils/bigint-serializer';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { QueueConfigService } from '@/modules/config/services/queue-config.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QueueTracingService } from '@/modules/opentelemetry/queue-tracing.service';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';

import { WithdrawalJobData } from './interfaces/withdrawal-job.interface';
import { WithdrawalService } from './withdrawal.service';

@Processor(QueueNames.INTENT_WITHDRAWAL, {
  concurrency: 5, // Will be overridden by constructor
})
export class WithdrawalProcessor extends WorkerHost implements OnModuleInit {
  constructor(
    @InjectQueue(QueueNames.INTENT_WITHDRAWAL) private withdrawalQueue: Queue,
    private withdrawalService: WithdrawalService,
    @Inject(QueueConfigService) private queueConfig: QueueConfigService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    @Optional() private readonly queueTracing?: QueueTracingService,
  ) {
    super();
    this.logger.setContext(WithdrawalProcessor.name);
  }

  onModuleInit() {
    // Set concurrency from configuration after worker is initialized
    if (this.worker) {
      // Use execution concurrency for now, or add specific withdrawal concurrency config
      this.worker.concurrency = this.queueConfig.executionConcurrency;
    }
  }

  async process(job: Job<string>) {
    const processFn = async (j: Job<string>) => {
      // Check if this is a scheduled check job
      if (j.name === 'check-proven-intents') {
        return this.processScheduledCheck();
      }

      // Otherwise, it's a regular withdrawal job
      const jobData = BigintSerializer.deserialize<WithdrawalJobData>(j.data);
      const { chainId, intents, walletId } = jobData;

      this.logger.log(`Processing withdrawal for chain ${chainId} with ${intents.length} intents`);

      try {
        // Execute the withdrawal
        const txHash = await this.withdrawalService.executeWithdrawal(chainId, intents, walletId);

        this.logger.log(
          `Successfully processed withdrawal for chain ${chainId}. TxHash: ${txHash}`,
        );

        return { chainId: chainId.toString(), txHash, intentCount: intents.length };
      } catch (error) {
        this.logger.error(
          `Failed to process withdrawal for chain ${chainId}: ${getErrorMessage(error)}`,
          toError(error),
        );
        throw error;
      }
    };

    // If tracing service is available, wrap the processor
    if (this.queueTracing) {
      const wrappedProcessor = this.queueTracing.wrapProcessor(
        'withdrawal',
        QueueNames.INTENT_WITHDRAWAL,
        processFn,
      );
      return wrappedProcessor(job);
    }

    return processFn(job);
  }

  /**
   * Process the scheduled check for proven intents
   */
  private async processScheduledCheck(): Promise<void> {
    const span = this.otelService.startSpan('withdrawal.processor.processScheduledCheck');

    try {
      this.logger.log('Running scheduled check for proven intents');

      // Find all proven intents that haven't been withdrawn
      const intents = await this.withdrawalService.findIntentsForWithdrawal();

      if (intents.length === 0) {
        this.logger.log('No proven intents found for withdrawal');
        span.setAttribute('withdrawal.intents_found', 0);
        span.setStatus({ code: 1 });
        return;
      }

      this.logger.log(`Found ${intents.length} proven intents for withdrawal`);
      span.setAttribute('withdrawal.intents_found', intents.length);

      // Group intents by chain
      const groupedIntents = this.withdrawalService.groupIntentsByChain(intents);
      const chainsToProcess = Array.from(groupedIntents.keys());

      span.setAttribute('withdrawal.chains_to_process', chainsToProcess.length);

      // Create withdrawal jobs for each chain
      const jobs: Array<{ chainId: bigint; data: WithdrawalJobData }> = [];

      for (const [chainId, chainIntents] of groupedIntents) {
        const jobData: WithdrawalJobData = {
          chainId,
          intents: chainIntents,
        };
        jobs.push({ chainId, data: jobData });
      }

      // Add all jobs to the queue
      const bulkJobs = jobs.map((job) => ({
        name: `withdraw-chain-${job.chainId}`,
        data: BigintSerializer.serialize(job.data),
        opts: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      }));

      await this.withdrawalQueue.addBulk(bulkJobs);

      this.logger.log(
        `Created ${jobs.length} withdrawal jobs for chains: ${chainsToProcess.join(', ')}`,
      );

      span.setAttributes({
        'withdrawal.jobs_created': jobs.length,
        'withdrawal.status': 'success',
      });
      span.setStatus({ code: 1 });
    } catch (error) {
      span.recordException(toError(error));
      span.setStatus({ code: 2 });
      this.logger.error('Error processing scheduled withdrawal check', toError(error));
      throw error;
    } finally {
      span.end();
    }
  }
}
