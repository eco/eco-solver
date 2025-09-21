import * as api from '@opentelemetry/api';
import { chunk, maxBy } from 'es-toolkit';
import { interval, Subscription } from 'rxjs';
import { TronWeb, Types as TronTypes } from 'tronweb';
import { getAbiItem, Hex, toEventHash } from 'viem';

import { portalAbi } from '@/common/abis/portal.abi';
import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { toError } from '@/common/utils/error-handler';
import { TvmNetworkConfig, TvmTransactionSettings } from '@/config/schemas';
import { EvmEventParser } from '@/modules/blockchain/evm/utils/evm-event-parser';
import { BlockchainEventJob } from '@/modules/blockchain/interfaces/blockchain-event-job.interface';
import { TronAddress } from '@/modules/blockchain/tvm/types';
import { TvmEvent } from '@/modules/blockchain/tvm/types/events.type';
import { TvmClientUtils } from '@/modules/blockchain/tvm/utils';
import { TvmEventParser } from '@/modules/blockchain/tvm/utils/tvm-event-parser';
import { TvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QueueService } from '@/modules/queue/queue.service';

// Constants for better maintainability
const CONSTANTS = {
  TIMESTAMP_OFFSET_MS: 1, // Add 1ms to exclude already processed events
  DEFAULT_EVENT_LIMIT: 200, // TronWeb API limit
  BATCH_PROCESSING_SIZE: 10, // Process events in batches
  EVENT_NAMES: {
    INTENT_FUNDED: 'IntentFunded',
    INTENT_FULFILLED: 'IntentFulfilled',
    INTENT_PROVEN: 'IntentProven',
    INTENT_WITHDRAWN: 'IntentWithdrawn',
    INTENT_PUBLISHED: 'IntentPublished',
  },
} as const;

interface ProcessingResult {
  success: boolean;
  error?: Error;
  intentHash?: string;
}

export class TronListener extends BaseChainListener {
  private pollingSubscription: Subscription | null = null;
  private proverPollingSubscription: Subscription | null = null;
  private lastBlockTimestamp: number = 0;
  private lastProverBlockTimestamp: number = 0;

  private tronWebClient: TronWeb;

  constructor(
    private readonly config: TvmNetworkConfig,
    private readonly transactionSettings: TvmTransactionSettings,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    private readonly tvmConfigService: TvmConfigService,
    private readonly queueService: QueueService,
  ) {
    super();
  }

  /**
   * Starts the blockchain listener with RxJS polling
   */
  async start(): Promise<void> {
    try {
      await this.initialize();
      this.startRxJSPolling();
      this.logger.log('TronListener started successfully', {
        chainId: this.config.chainId,
        pollInterval: this.transactionSettings.listenerPollInterval,
      });
    } catch (error) {
      this.logger.error('Failed to start TronListener', toError(error));
      throw error;
    }
  }

  /**
   * Stops the blockchain listener gracefully
   */
  async stop(): Promise<void> {
    this.pollingSubscription?.unsubscribe();
    this.proverPollingSubscription?.unsubscribe();
    this.logger.warn('TronListener stopped', { chainId: this.config.chainId });
  }

  /**
   * Initialize listener components
   */
  private async initialize(): Promise<void> {
    // Create and validate TronWeb client
    this.tronWebClient = TvmClientUtils.createClient(this.config);

    // Get initial timestamp
    await this.initializeLastTimestamp();
  }

  /**
   * Initialize the last processed timestamp
   */
  private async initializeLastTimestamp(): Promise<void> {
    const currentBlock = await this.tronWebClient.trx.getConfirmedCurrentBlock();
    if (!currentBlock?.block_header?.raw_data?.timestamp) {
      throw new Error('Failed to get initial block timestamp');
    }

    this.lastBlockTimestamp = currentBlock.block_header.raw_data.timestamp;
    this.lastProverBlockTimestamp = currentBlock.block_header.raw_data.timestamp;
  }

  /**
   * Start RxJS-based polling
   */
  private startRxJSPolling(): void {
    // Start Portal events polling (IntentPublished, IntentFulfilled, etc.)
    this.startPortalEventPolling();

    // Start Prover events polling (IntentProven) with a longer interval
    this.startProverEventPolling();
  }

  /**
   * Start polling for Portal events
   */
  private startPortalEventPolling(): void {
    // Create interval-based polling
    this.pollingSubscription = interval(this.transactionSettings.listenerPollInterval).subscribe({
      next: () => {
        this.pollForPortalEvents().catch((error) => {
          this.logger.error(`Portal polling error`, toError(error));
        });
      },
    });
  }

  /**
   * Start polling for Prover events with longer interval
   */
  private startProverEventPolling(): void {
    this.pollingSubscription = interval(this.transactionSettings.proverListenerInterval).subscribe({
      next: () => {
        this.pollForProverEvents().catch((error) => {
          this.logger.error(`Provers polling error`, toError(error));
        });
      },
    });
  }

  /**
   * Poll for Prover events (IntentProven)
   */
  private async pollForProverEvents() {
    // Fetch events directly
    const minBlockTimestamp = this.lastProverBlockTimestamp + CONSTANTS.TIMESTAMP_OFFSET_MS;

    const network = this.tvmConfigService.getChain(this.config.chainId);
    const provers = network.provers;

    // Fetch events from all configured prover addresses
    const requests = Object.entries(provers).map(([proverType, proverAddr]) => {
      return this.pollForEvents(`prover.${proverType}`, proverAddr, {
        minBlockTimestamp,
        eventName: CONSTANTS.EVENT_NAMES.INTENT_PROVEN,
      });
    });
    const responses = await Promise.allSettled(requests);

    const timestamps = responses
      .map((res) => (res.status === 'fulfilled' ? res.value.timestamp : undefined))
      .filter((item): item is number => !!item);

    const timestamp = timestamps.length ? Math.max(...timestamps) : undefined;
    return { timestamp };
  }

  /**
   * Poll for Portal events (IntentPublished, IntentFulfilled, IntentWithdrawn)
   */
  private async pollForPortalEvents() {
    // Fetch events directly
    const portalAddress = this.tvmConfigService.getTvmPortalAddress(this.config.chainId);
    const minBlockTimestamp = this.lastBlockTimestamp + CONSTANTS.TIMESTAMP_OFFSET_MS;

    return this.pollForEvents('portal', portalAddress, { minBlockTimestamp });
  }

  /**
   * Poll for Portal events (IntentPublished, IntentFulfilled, IntentWithdrawn)
   */
  private async pollForEvents(
    contractName: string,
    contractAddress: TronAddress,
    opts: { minBlockTimestamp: number; eventName?: string },
  ) {
    return this.otelService.tracer.startActiveSpan(
      `tvm.listener.poll.${contractName}`,
      { attributes: { 'tvm.chain_id': this.config.chainId.toString() } },
      async (span) => {
        try {
          const eventsResponse = await this.tronWebClient.event.getEventsByContractAddress(
            contractAddress,
            {
              ...opts,
              onlyConfirmed: true,
              orderBy: 'block_timestamp,asc',
              limit: CONSTANTS.DEFAULT_EVENT_LIMIT,
            },
          );

          span.addEvent('tvm.events.fetched');

          if (!eventsResponse.success) {
            this.logger.error(`Failed to get ${contractName} events: ${eventsResponse.error}`);
            throw new Error(`Failed to get ${contractName} events`);
          }

          const events = eventsResponse.data || [];

          // Process events in batches
          const processingResults = await this.processEventsBatch(events);

          const eventsProcessed = processingResults.filter((r) => r.success).length;
          const errors = processingResults.filter((r) => !r.success).map((r) => r.error!);

          const timestamp = eventsProcessed > 0 ? this.calculateNewestTimestamp(events) : undefined;

          span.setAttributes({
            'tvm.events.processed': eventsProcessed,
            'tvm.events.errors': errors.length,
            'tvm.last_timestamp': timestamp ?? opts.minBlockTimestamp,
          });

          if (errors.length > 0) {
            errors.forEach((error) => span.recordException(error));
          }

          span.setStatus({ code: api.SpanStatusCode.OK });

          return { timestamp };
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Fetch prover events (IntentProven) from the blockchain
   */
  private async fetchProverEvents(): Promise<TvmEvent[]> {
    const minBlockTimestamp = this.lastProverBlockTimestamp + CONSTANTS.TIMESTAMP_OFFSET_MS;
    const allProverEvents: TvmEvent[] = [];

    const network = this.tvmConfigService.getChain(this.config.chainId);
    const provers = network.provers;

    // Fetch events from all configured prover addresses
    for (const [proverType, proverAddress] of Object.entries(provers)) {
      try {
        const proverEventsResponse = await this.tronWebClient.event.getEventsByContractAddress(
          proverAddress,
          {
            eventName: CONSTANTS.EVENT_NAMES.INTENT_PROVEN,
            onlyConfirmed: true,
            minBlockTimestamp,
            orderBy: 'block_timestamp,asc',
            limit: CONSTANTS.DEFAULT_EVENT_LIMIT,
          },
        );

        if (proverEventsResponse.data && proverEventsResponse.data.length) {
          this.logger.debug(
            `Found ${proverEventsResponse.data.length} IntentProven events from ${proverType} prover`,
          );
          allProverEvents.push(...proverEventsResponse.data);
        }
      } catch (error) {
        this.logger.error(`Failed to fetch events from ${proverType} prover`, toError(error));
      }
    }

    return allProverEvents;
  }

  /**
   * Process events in batches for better performance
   */
  private async processEventsBatch(events: TvmEvent[]): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    const intentFundedTxIds = new Set<string>();

    // First pass: collect IntentFunded transaction IDs and process other events
    for (const event of events) {
      try {
        const result = await this.routeEventProcessing(event, intentFundedTxIds);
        results.push(result);
      } catch (error) {
        results.push({ success: false, error: toError(error) });
      }
    }

    // Second pass: process IntentPublished events from IntentFunded transactions
    const txResults = await this.processIntentFundedTransactions(intentFundedTxIds);
    results.push(...txResults);

    return results;
  }

  /**
   * Route event to appropriate processor
   */
  private async routeEventProcessing(
    event: TvmEvent,
    intentFundedTxIds: Set<string>,
  ): Promise<ProcessingResult> {
    switch (event.event_name) {
      case CONSTANTS.EVENT_NAMES.INTENT_FUNDED:
        intentFundedTxIds.add(event.transaction_id);
        return { success: true };

      case CONSTANTS.EVENT_NAMES.INTENT_FULFILLED:
        return await this.processIntentFulfilledEvent(event);

      case CONSTANTS.EVENT_NAMES.INTENT_PROVEN:
        return await this.processIntentProvenEvent(event);

      case CONSTANTS.EVENT_NAMES.INTENT_WITHDRAWN:
        return await this.processIntentWithdrawnEvent(event);

      default:
        this.logger.debug('Unknown event type', { eventName: event.event_name });
        return { success: true };
    }
  }

  /**
   * Process IntentFunded transactions to extract IntentPublished events
   */
  private async processIntentFundedTransactions(txIds: Set<string>): Promise<ProcessingResult[]> {
    if (txIds.size === 0) return [];

    const results: ProcessingResult[] = [];
    const txBatches = chunk(Array.from(txIds), CONSTANTS.BATCH_PROCESSING_SIZE);

    for (const batch of txBatches) {
      const batchResults = await Promise.allSettled(
        batch.map((txId) => this.processTransaction(txId)),
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({ success: false, error: result.reason });
        }
      }
    }

    return results;
  }

  /**
   * Process IntentFulfilled event with improved error handling
   */
  private async processIntentFulfilledEvent(event: TvmEvent): Promise<ProcessingResult> {
    try {
      const fulfilledEvent = TvmEventParser.parseTvmIntentFulfilled(
        BigInt(this.config.chainId),
        event,
      );

      // Queue the event for processing
      const eventJob: BlockchainEventJob = {
        eventType: 'IntentFulfilled',
        chainId: this.config.chainId,
        chainType: 'tvm',
        contractName: 'portal',
        intentHash: fulfilledEvent.intentHash,
        eventData: event,
        metadata: {
          txHash: event.transaction_id,
          blockNumber: event.block_number ? BigInt(event.block_number) : undefined,
          contractAddress: this.tvmConfigService.getPortalAddress(this.config.chainId),
          timestamp: event.block_timestamp,
        },
      };

      await this.queueService.addBlockchainEvent(eventJob);
      this.logger.debug(
        `Queued IntentFulfilled event for intent ${fulfilledEvent.intentHash} from Tron`,
      );

      return { success: true, intentHash: fulfilledEvent.intentHash };
    } catch (error) {
      this.logger.error(`Failed to queue IntentFulfilled event:`, toError(error));
      return { success: false, error: toError(error) };
    }
  }

  /**
   * Process IntentProven event
   */
  private async processIntentProvenEvent(event: TvmEvent) {
    try {
      const portalAddress = AddressNormalizer.denormalizeToTvm(
        this.tvmConfigService.getPortalAddress(this.config.chainId),
      );
      if (event.contract_address === portalAddress) {
        // Ignore IntentProven events from the Portal contract
        return { success: true };
      }

      const parsedEvent = TvmEventParser.parseIntentProvenEvent(event, this.config.chainId);

      // Queue the event for processing
      const eventJob: BlockchainEventJob = {
        eventType: 'IntentProven',
        chainId: this.config.chainId,
        chainType: 'tvm',
        contractName: 'prover',
        intentHash: parsedEvent.intentHash,
        eventData: event,
        metadata: {
          txHash: event.transaction_id,
          blockNumber: event.block_number ? BigInt(event.block_number) : undefined,
          contractAddress: event.contract_address,
          timestamp: event.block_timestamp,
        },
      };

      await this.queueService.addBlockchainEvent(eventJob);
      this.logger.debug(`Queued IntentProven event for intent ${parsedEvent.intentHash} from Tron`);

      return { success: true, intentHash: parsedEvent.intentHash };
    } catch (error) {
      this.logger.error(`Failed to queue IntentProven event:`, toError(error));
      return { success: false, error: toError(error) };
    }
  }

  /**
   * Process IntentWithdrawn event
   */
  private async processIntentWithdrawnEvent(event: TvmEvent): Promise<ProcessingResult> {
    try {
      const parsedEvent = TvmEventParser.parseIntentWithdrawnEvent(event, this.config.chainId);

      // Queue the event for processing
      const eventJob: BlockchainEventJob = {
        eventType: 'IntentWithdrawn',
        chainId: this.config.chainId,
        chainType: 'tvm',
        contractName: 'portal',
        intentHash: parsedEvent.intentHash,
        eventData: event,
        metadata: {
          txHash: event.transaction_id,
          blockNumber: event.block_number ? BigInt(event.block_number) : undefined,
          contractAddress: this.tvmConfigService.getPortalAddress(this.config.chainId),
          timestamp: event.block_timestamp,
        },
      };

      await this.queueService.addBlockchainEvent(eventJob);
      this.logger.debug(
        `Queued IntentWithdrawn event for intent ${parsedEvent.intentHash} from Tron`,
      );

      return { success: true, intentHash: parsedEvent.intentHash };
    } catch (error) {
      this.logger.error(`Failed to queue IntentWithdrawn event:`, toError(error));
      return { success: false, error: toError(error) };
    }
  }

  /**
   * Process a transaction to extract IntentPublished events
   */
  private async processTransaction(txId: string): Promise<ProcessingResult> {
    return this.otelService.tracer.startActiveSpan(
      'tvm.listener.processTransaction',
      {
        attributes: {
          'tvm.transaction_id': txId,
          'tvm.chain_id': this.config.chainId.toString(),
        },
      },
      async (span: api.Span) => {
        try {
          const txInfo = await this.tronWebClient.trx.getTransactionInfo(txId);

          const intent = this.extractIntentFromTransaction(txInfo);
          if (intent) {
            intent.publishTxHash = txInfo.id;
            await this.processIntentEvent(intent);
            span.setStatus({ code: api.SpanStatusCode.OK });
            return { success: true, intentHash: intent.intentHash };
          }

          span.setStatus({ code: api.SpanStatusCode.OK });
          return { success: true };
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          return { success: false, error: toError(error) };
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Extract IntentPublished event from transaction logs
   */
  private extractIntentFromTransaction(txInfo: TronTypes.TransactionInfo): Intent | null {
    const intentPublishedEventHash = toEventHash(
      getAbiItem({ abi: portalAbi, name: 'IntentPublished' }),
    );

    for (const log of txInfo.log) {
      const topics = this.normalizeTopics(log.topics);

      if (topics[0] !== intentPublishedEventHash) {
        continue;
      }

      const data = this.normalizeHexData(log.data);
      const evmLog = { topics, data: data as Hex };

      try {
        return EvmEventParser.parseIntentPublish(BigInt(this.config.chainId), evmLog);
      } catch (error) {
        this.logger.error('Failed to parse IntentPublished event', toError(error), {
          txId: txInfo.id,
        });
      }
    }

    return null;
  }

  /**
   * Process discovered intent
   */
  private async processIntentEvent(intent: Intent): Promise<void> {
    try {
      // Queue the event for processing
      const eventJob: BlockchainEventJob = {
        eventType: 'IntentPublished',
        chainId: this.config.chainId,
        chainType: 'tvm',
        contractName: 'portal',
        intentHash: intent.intentHash,
        eventData: intent, // For Tron, we pass the parsed intent
        metadata: {
          txHash: intent.publishTxHash,
          contractAddress: this.tvmConfigService.getPortalAddress(this.config.chainId),
        },
      };

      await this.queueService.addBlockchainEvent(eventJob);
      this.logger.debug(
        `Queued IntentPublished event for intent ${intent.intentHash} from Tron chain ${this.config.chainId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue IntentPublished event for intent ${intent.intentHash}:`,
        toError(error),
      );
    }
  }

  // Utility methods

  /**
   * Calculate the newest timestamp from events
   */
  private calculateNewestTimestamp(events: TvmEvent[]): number {
    const newestEvent = maxBy(events, (event) => event.block_timestamp || 0);
    return newestEvent?.block_timestamp || this.lastBlockTimestamp;
  }

  /**
   * Normalize topic array to ensure '0x' prefix
   */
  private normalizeTopics(topics: string[]): [Hex, ...Hex[]] {
    return topics.map((topic: string) => (topic.startsWith('0x') ? topic : `0x${topic}`)) as [
      Hex,
      ...Hex[],
    ];
  }

  /**
   * Normalize hex data to ensure '0x' prefix
   */
  private normalizeHexData(data: string | undefined): string {
    if (!data) return '0x';
    return data.startsWith('0x') ? data : `0x${data}`;
  }
}
