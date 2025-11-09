import { Optional } from '@nestjs/common';

import { interval, of, Subscription } from 'rxjs';
import { catchError, retry, switchMap } from 'rxjs/operators';

import { toError } from '@/common/utils/error-handler';
import { BlockchainEventJob } from '@/modules/blockchain/interfaces/blockchain-event-job.interface';
import { SystemLoggerService } from '@/modules/logging';
import { QueueService } from '@/modules/queue/queue.service';

import { IndexerService } from '../indexer.service';
import { IndexerConfigService } from '../indexer-config.service';
import type {
  IndexedFulfillment,
  IndexedIntent,
  IndexedRefund,
  IndexedWithdrawal,
} from '../types/intent.types';

export class IndexListener {
  private readonly logger: SystemLoggerService;
  private subscriptions: Subscription[] = [];
  private lastQueriedTimestamps: Map<string, bigint> = new Map();
  private readonly chainPortalMap: Map<number, string[]> = new Map();
  private readonly allPortalAddresses: string[];

  constructor(
    chainConfigs: Array<{ chainId: number; portalAddresses: string[] }>,
    @Optional() private readonly indexerService: IndexerService | null,
    private readonly queueService: QueueService,
    private readonly indexerConfigService: IndexerConfigService,
    logger: SystemLoggerService,
  ) {
    this.logger = logger;
    this.logger.setContext('IndexListener');

    // Build chain-to-portal mapping and collect all portal addresses
    for (const config of chainConfigs) {
      this.chainPortalMap.set(config.chainId, config.portalAddresses);
    }

    // Flatten all portal addresses for indexer queries
    this.allPortalAddresses = Array.from(this.chainPortalMap.values()).flat();

    this.logger.log(
      `Initialized for ${chainConfigs.length} chains with ${this.allPortalAddresses.length} portal addresses`,
    );
  }

  async start(): Promise<void> {
    if (!this.indexerService) {
      this.logger.warn('IndexerService not available, skipping IndexListener');
      return;
    }

    if (!this.indexerConfigService.isConfigured()) {
      this.logger.warn('Indexer not configured, skipping IndexListener');
      return;
    }

    this.logger.log('Starting IndexListener');

    // Create separate polling subscription for each event type
    this.startPollingPublishedIntents();
    this.startPollingFulfilledIntents();
    this.startPollingWithdrawnIntents();
    this.startPollingFundedIntents();
  }

  async stop(): Promise<void> {
    this.logger.log('Stopping IndexListener');

    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }

    this.subscriptions = [];
  }

  private startPollingPublishedIntents(): void {
    const intervalMs = this.indexerConfigService.intervals.intentPublished;

    const subscription = interval(intervalMs)
      .pipe(
        switchMap(async () => {
          const since = this.getLastTimestamp('IntentPublished');
          return this.fetchPublishedIntents(since);
        }),
        catchError((error) => {
          this.logger.error('Error polling published intents', error);
          return of([]);
        }),
        retry({ delay: 5000 }),
      )
      .subscribe({
        next: (events) => this.processEvents(events),
        error: (error) => this.logger.error('Fatal polling error', error),
      });

    this.subscriptions.push(subscription);
    this.logger.log(`Started polling for IntentPublished events (${intervalMs}ms interval)`);
  }

  private startPollingFulfilledIntents(): void {
    const intervalMs = this.indexerConfigService.intervals.intentFulfilled;

    const subscription = interval(intervalMs)
      .pipe(
        switchMap(async () => {
          const since = this.getLastTimestamp('IntentFulfilled');
          return this.fetchFulfilledIntents(since);
        }),
        catchError((error) => {
          this.logger.error('Error polling fulfilled intents', error);
          return of([]);
        }),
        retry({ delay: 5000 }),
      )
      .subscribe({
        next: (events) => this.processEvents(events),
        error: (error) => this.logger.error('Fatal polling error', error),
      });

    this.subscriptions.push(subscription);
    this.logger.log(`Started polling for IntentFulfilled events (${intervalMs}ms interval)`);
  }

  private startPollingWithdrawnIntents(): void {
    const intervalMs = this.indexerConfigService.intervals.intentWithdrawn;

    const subscription = interval(intervalMs)
      .pipe(
        switchMap(async () => {
          const since = this.getLastTimestamp('IntentWithdrawn');
          return this.fetchWithdrawnIntents(since);
        }),
        catchError((error) => {
          this.logger.error('Error polling withdrawn intents', error);
          return of([]);
        }),
        retry({ delay: 5000 }),
      )
      .subscribe({
        next: (events) => this.processEvents(events),
        error: (error) => this.logger.error('Fatal polling error', error),
      });

    this.subscriptions.push(subscription);
    this.logger.log(`Started polling for IntentWithdrawn events (${intervalMs}ms interval)`);
  }

  private startPollingFundedIntents(): void {
    const intervalMs = this.indexerConfigService.intervals.intentFunded;

    const subscription = interval(intervalMs)
      .pipe(
        switchMap(async () => {
          const since = this.getLastTimestamp('IntentFunded');
          return this.fetchFundedIntents(since);
        }),
        catchError((error) => {
          this.logger.error('Error polling funded intents', error);
          return of([]);
        }),
        retry({ delay: 5000 }),
      )
      .subscribe({
        next: (events) => this.processEvents(events),
        error: (error) => this.logger.error('Fatal polling error', error),
      });

    this.subscriptions.push(subscription);
    this.logger.log(`Started polling for IntentFunded events (${intervalMs}ms interval)`);
  }

  private async fetchPublishedIntents(since: bigint): Promise<BlockchainEventJob[]> {
    if (!this.indexerService) {
      return [];
    }

    const jobs: BlockchainEventJob[] = [];

    try {
      // Query indexer with pagination - query all portal addresses across all chains
      const iterator = this.indexerService.queryPublishedIntents({
        portalAddresses: this.allPortalAddresses,
        since,
      });

      for await (const batch of iterator) {
        for (const intent of batch) {
          // Validate that this chain is supported
          if (!this.chainPortalMap.has(intent.chainId)) {
            this.logger.warn(`Received intent from unsupported chain ${intent.chainId}, skipping`);
            continue;
          }

          // Convert to BlockchainEventJob
          const job = this.convertPublishedIntentToJob(intent);
          jobs.push(job);

          // Update last timestamp per chain
          this.updateLastTimestamp('IntentPublished', intent.chainId, intent.blockTimestamp);
        }
      }

      if (jobs.length > 0) {
        this.logger.debug(`Fetched ${jobs.length} published intents from indexer`);
      }
    } catch (error) {
      this.logger.error('Failed to fetch published intents', toError(error));
    }

    return jobs;
  }

  private async fetchFulfilledIntents(since: bigint): Promise<BlockchainEventJob[]> {
    if (!this.indexerService) {
      return [];
    }

    const jobs: BlockchainEventJob[] = [];

    try {
      // Query indexer with pagination - query all portal addresses across all chains
      const iterator = this.indexerService.queryFulfilledIntents({
        portalAddresses: this.allPortalAddresses,
        since,
      });

      for await (const batch of iterator) {
        for (const fulfillment of batch) {
          // Validate that this chain is supported
          if (!this.chainPortalMap.has(fulfillment.chainId)) {
            this.logger.warn(
              `Received fulfillment from unsupported chain ${fulfillment.chainId}, skipping`,
            );
            continue;
          }

          // Convert to BlockchainEventJob
          const job = this.convertFulfillmentToJob(fulfillment);
          jobs.push(job);

          // Update last timestamp per chain
          this.updateLastTimestamp(
            'IntentFulfilled',
            fulfillment.chainId,
            fulfillment.blockTimestamp,
          );
        }
      }

      if (jobs.length > 0) {
        this.logger.debug(`Fetched ${jobs.length} fulfilled intents from indexer`);
      }
    } catch (error) {
      this.logger.error('Failed to fetch fulfilled intents', toError(error));
    }

    return jobs;
  }

  private async fetchWithdrawnIntents(since: bigint): Promise<BlockchainEventJob[]> {
    if (!this.indexerService) {
      return [];
    }

    const jobs: BlockchainEventJob[] = [];

    try {
      // Query indexer with pagination - query all portal addresses across all chains
      const iterator = this.indexerService.queryWithdrawnIntents({
        portalAddresses: this.allPortalAddresses,
        since,
      });

      for await (const batch of iterator) {
        for (const withdrawal of batch) {
          // Validate that this chain is supported
          if (!this.chainPortalMap.has(withdrawal.chainId)) {
            this.logger.warn(
              `Received withdrawal from unsupported chain ${withdrawal.chainId}, skipping`,
            );
            continue;
          }

          // Convert to BlockchainEventJob
          const job = this.convertWithdrawalToJob(withdrawal);
          jobs.push(job);

          // Update last timestamp per chain
          this.updateLastTimestamp(
            'IntentWithdrawn',
            withdrawal.chainId,
            withdrawal.blockTimestamp,
          );
        }
      }

      if (jobs.length > 0) {
        this.logger.debug(`Fetched ${jobs.length} withdrawn intents from indexer`);
      }
    } catch (error) {
      this.logger.error('Failed to fetch withdrawn intents', toError(error));
    }

    return jobs;
  }

  private async fetchFundedIntents(since: bigint): Promise<BlockchainEventJob[]> {
    if (!this.indexerService) {
      return [];
    }

    const jobs: BlockchainEventJob[] = [];

    try {
      // Query indexer with pagination - query all portal addresses across all chains
      const iterator = this.indexerService.queryFundedIntents({
        portalAddresses: this.allPortalAddresses,
        since,
      });

      for await (const batch of iterator) {
        for (const refund of batch) {
          // Validate that this chain is supported
          if (!this.chainPortalMap.has(refund.chainId)) {
            this.logger.warn(`Received refund from unsupported chain ${refund.chainId}, skipping`);
            continue;
          }

          // Convert to BlockchainEventJob
          const job = this.convertRefundToJob(refund);
          jobs.push(job);

          // Update last timestamp per chain
          this.updateLastTimestamp('IntentFunded', refund.chainId, refund.blockTimestamp);
        }
      }

      if (jobs.length > 0) {
        this.logger.debug(`Fetched ${jobs.length} funded intents from indexer`);
      }
    } catch (error) {
      this.logger.error('Failed to fetch funded intents', toError(error));
    }

    return jobs;
  }

  private convertPublishedIntentToJob(intent: IndexedIntent): BlockchainEventJob {
    return {
      eventType: 'IntentPublished',
      chainId: intent.chainId,
      chainType: 'evm',
      contractName: 'portal',
      intentHash: intent.hash,
      eventData: {
        args: intent.params,
        transactionHash: intent.transactionHash,
        blockNumber: intent.blockNumber,
        logIndex: intent.evt_log_index,
        address: intent.evt_log_address,
      },
      metadata: {
        txHash: intent.transactionHash,
        blockNumber: Number(intent.blockNumber),
        logIndex: intent.evt_log_index,
        contractAddress: intent.evt_log_address,
        timestamp: Number(intent.blockTimestamp),
      },
    };
  }

  private convertFulfillmentToJob(fulfillment: IndexedFulfillment): BlockchainEventJob {
    return {
      eventType: 'IntentFulfilled',
      chainId: fulfillment.chainId,
      chainType: 'evm',
      contractName: 'portal',
      intentHash: fulfillment.hash,
      eventData: {
        transactionHash: fulfillment.transactionHash,
        blockNumber: fulfillment.blockNumber,
        logIndex: fulfillment.evt_log_index,
        address: fulfillment.evt_log_address,
      },
      metadata: {
        txHash: fulfillment.transactionHash,
        blockNumber: Number(fulfillment.blockNumber),
        logIndex: fulfillment.evt_log_index,
        contractAddress: fulfillment.evt_log_address,
        timestamp: Number(fulfillment.blockTimestamp),
      },
    };
  }

  private convertWithdrawalToJob(withdrawal: IndexedWithdrawal): BlockchainEventJob {
    return {
      eventType: 'IntentWithdrawn',
      chainId: withdrawal.chainId,
      chainType: 'evm',
      contractName: 'portal',
      intentHash: withdrawal.hash,
      eventData: {
        transactionHash: withdrawal.transactionHash,
        blockNumber: withdrawal.blockNumber,
        logIndex: withdrawal.evt_log_index,
        address: withdrawal.evt_log_address,
      },
      metadata: {
        txHash: withdrawal.transactionHash,
        blockNumber: Number(withdrawal.blockNumber),
        logIndex: withdrawal.evt_log_index,
        contractAddress: withdrawal.evt_log_address,
        timestamp: Number(withdrawal.blockTimestamp),
      },
    };
  }

  private convertRefundToJob(refund: IndexedRefund): BlockchainEventJob {
    return {
      eventType: 'IntentFunded',
      chainId: refund.chainId,
      chainType: 'evm',
      contractName: 'portal',
      intentHash: refund.hash,
      eventData: {
        transactionHash: refund.transactionHash,
        blockNumber: refund.blockNumber,
        logIndex: refund.evt_log_index,
        address: refund.evt_log_address,
      },
      metadata: {
        txHash: refund.transactionHash,
        blockNumber: Number(refund.blockNumber),
        logIndex: refund.evt_log_index,
        contractAddress: refund.evt_log_address,
        timestamp: Number(refund.blockTimestamp),
      },
    };
  }

  private async processEvents(events: BlockchainEventJob[]): Promise<void> {
    for (const event of events) {
      try {
        await this.queueService.addBlockchainEvent(event);
      } catch (error) {
        this.logger.error(`Failed to queue event ${event.intentHash}`, toError(error));
      }
    }
  }

  private getLastTimestamp(eventType: string): bigint {
    // Get the minimum timestamp across all chains for this event type
    // This ensures we don't miss events from any chain
    let minTimestamp = BigInt(Number.MAX_SAFE_INTEGER);
    let hasTimestamp = false;

    for (const chainId of this.chainPortalMap.keys()) {
      const key = `${chainId}-${eventType}`;
      const timestamp = this.lastQueriedTimestamps.get(key);
      if (timestamp !== undefined) {
        hasTimestamp = true;
        if (timestamp < minTimestamp) {
          minTimestamp = timestamp;
        }
      }
    }

    return hasTimestamp ? minTimestamp : BigInt(0);
  }

  private updateLastTimestamp(eventType: string, chainId: number, timestamp: bigint): void {
    const key = `${chainId}-${eventType}`;
    const current = this.lastQueriedTimestamps.get(key) ?? BigInt(0);
    if (timestamp > current) {
      this.lastQueriedTimestamps.set(key, timestamp);
    }
  }
}
