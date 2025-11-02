import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { Job, Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { BigintSerializer } from '@/common/utils/bigint-serializer';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { QueueConfigService } from '@/modules/config/services/queue-config.service';
import { BullMQOtelFactory } from '@/modules/opentelemetry/bullmq-otel.factory';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';

import { WithdrawalJobData } from './interfaces/withdrawal-job.interface';
import { WithdrawalService } from './withdrawal.service';

@Processor(QueueNames.INTENT_WITHDRAWAL, {
  prefix: `{${QueueNames.INTENT_WITHDRAWAL}}`,
})
export class WithdrawalProcessor extends WorkerHost implements OnModuleInit, OnModuleDestroy {
  constructor(
    @InjectPinoLogger(WithdrawalProcessor.name) private readonly logger: PinoLogger,
    @InjectQueue(QueueNames.INTENT_WITHDRAWAL) private withdrawalQueue: Queue,
    private withdrawalService: WithdrawalService,
    @Inject(QueueConfigService) private queueConfig: QueueConfigService,
    private readonly otelService: OpenTelemetryService,
    @Inject(BullMQOtelFactory) private bullMQOtelFactory: BullMQOtelFactory,
  ) {
    super();
  }

  onModuleInit() {
    // Set concurrency from configuration after worker is initialized
    if (this.worker) {
      // Use execution concurrency for now, or add specific withdrawal concurrency config
      this.worker.concurrency = this.queueConfig.executionConcurrency;

      // Add telemetry if available
      const telemetry = this.bullMQOtelFactory.getInstance();
      if (telemetry && !this.worker.opts.telemetry) {
        this.worker.opts.telemetry = telemetry;
        this.logger.info('Added BullMQOtel telemetry to WithdrawalProcessor worker');
      }
    }
  }

  async onModuleDestroy() {
    // Close the worker to ensure clean shutdown
    if (this.worker) {
      this.logger.info('Closing WithdrawalProcessor worker...');
      await this.worker.close();
      this.logger.info('WithdrawalProcessor worker closed');
    }
  }

  async process(job: Job<string>) {
    const jobData = BigintSerializer.deserialize<WithdrawalJobData>(job.data);

    // Check if this is a scheduled check job
    if (job.name === 'check-proven-intents') {
      return this.processScheduledCheck();
    }

    const processFn = async (jobData: WithdrawalJobData, j: Job<string>) => {
      // Check if this is a scheduled check job
      if (j.name === 'check-proven-intents') {
        return this.processScheduledCheck();
      }

      // Otherwise, it's a regular withdrawal job
      const { chainId, intents, walletId } = jobData;

      this.logger.info(`Processing withdrawal for chain ${chainId} with ${intents.length} intents`);

      try {
        // Execute the withdrawal
        const txHash = await this.withdrawalService.executeWithdrawal(chainId, intents, walletId);

        this.logger.info(
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

    return processFn(jobData, job);
  }

  /**
   * Process the scheduled check for proven intents
   */
  private async processScheduledCheck(): Promise<void> {
    return this.otelService.tracer.startActiveSpan(
      'withdrawal.processor.processScheduledCheck',
      async (span) => {
        try {
          this.logger.info('Running scheduled check for proven intents');

          // Find all proven intents that haven't been withdrawn
          const intents = await this.withdrawalService.findIntentsForWithdrawal();

          if (intents.length === 0) {
            this.logger.info('No proven intents found for withdrawal');
            span.setAttribute('withdrawal.intents_found', 0);
            span.setStatus({ code: 1 });
            return;
          }

          this.logger.info(`Found ${intents.length} proven intents for withdrawal`);
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

          this.logger.info(
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
      },
    );
  }
}
