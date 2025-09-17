import * as api from '@opentelemetry/api';
import { chunk, maxBy } from 'es-toolkit';
import { Subscription } from 'rxjs';
import { TronWeb } from 'tronweb';
import { getAbiItem, Hex, toEventHash } from 'viem';

import { portalAbi } from '@/common/abis/portal.abi';
import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType } from '@/common/utils/chain-type-detector';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { executeWithRetry, pollWithRetry, RetryConfig } from '@/common/utils/rxjs-retry.util';
import { TvmNetworkConfig, TvmTransactionSettings } from '@/config/schemas';
import { EvmEventParser } from '@/modules/blockchain/evm/utils/evm-event-parser';
import { TvmEvent, TvmEventResponse } from '@/modules/blockchain/tvm/types/events.type';
import { TvmClientUtils } from '@/modules/blockchain/tvm/utils';
import { TvmEventParser } from '@/modules/blockchain/tvm/utils/tvm-event-parser';
import { TvmUtils } from '@/modules/blockchain/tvm/utils/tvm-utils';
import { TvmConfigService } from '@/modules/config/services';
import { EventsService } from '@/modules/events/events.service';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

// Constants for better maintainability
const CONSTANTS = {
  TIMESTAMP_OFFSET_MS: 1, // Add 1ms to exclude already processed events
  DEFAULT_EVENT_LIMIT: 200, // TronWeb API limit
  BATCH_PROCESSING_SIZE: 10, // Process events in batches
  METRICS: {
    POLL_COUNT: 'tvm.poll.count',
    EVENTS_FOUND: 'tvm.poll.events_found',
    POLL_DURATION: 'tvm.poll.duration',
    POLL_ERRORS: 'tvm.poll.errors',
    EVENT_PROCESSING_ERRORS: 'tvm.event.processing.errors',
  },
  EVENT_NAMES: {
    INTENT_FUNDED: 'IntentFunded',
    INTENT_FULFILLED: 'IntentFulfilled',
    INTENT_PROVEN: 'IntentProven',
    INTENT_WITHDRAWN: 'IntentWithdrawn',
    INTENT_PUBLISHED: 'IntentPublished',
  },
} as const;

// Type guards for better type safety
function isValidEventResponse(response: unknown): response is TvmEventResponse {
  return response !== null && typeof response === 'object' && 'data' in response;
}

function hasValidEventData(event: TvmEvent): boolean {
  return !!(event?.event_name && event?.transaction_id);
}

interface ProcessingResult {
  success: boolean;
  error?: Error;
  intentHash?: string;
}

interface PollResult {
  eventsProcessed: number;
  errors: Error[];
  lastTimestamp: number;
}

export class TronListener extends BaseChainListener {
  private pollingSubscription: Subscription | null = null;
  private proverPollingSubscription: Subscription | null = null;
  private lastBlockTimestamp: number = 0;
  private lastProverBlockTimestamp: number = 0;
  private isRunning: boolean = false;
  private readonly proverAddresses: Map<string, string> = new Map();
  private tronWebClient: TronWeb | null = null;

  // Metrics instruments
  private readonly metrics: {
    pollCounter: api.Counter;
    eventsFoundCounter: api.Counter;
    pollDurationHistogram: api.Histogram;
    pollErrorCounter: api.Counter;
    eventProcessingErrorCounter: api.Counter;
  };

  // Retry configuration
  private readonly retryConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    shouldRetry: (error: Error) => {
      // Don't retry on certain errors
      const message = error.message.toLowerCase();
      return !message.includes('portal address') && !message.includes('not initialized');
    },
    onRetry: (error: Error, attempt: number) => {
      this.logger.warn(`Retry attempt ${attempt}`, {
        error: error.message,
      });
    },
  };

  constructor(
    private readonly config: TvmNetworkConfig,
    private readonly transactionSettings: TvmTransactionSettings,
    private readonly eventsService: EventsService,
    private readonly fulfillmentService: FulfillmentService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    private readonly tvmConfigService: TvmConfigService,
  ) {
    super();
    this.metrics = this.initializeMetrics();
  }

  /**
   * Starts the blockchain listener with RxJS polling
   */
  async start(): Promise<void> {
    try {
      await this.initialize();
      this.startRxJSPolling();
      this.logger.log('TronListener started successfully with RxJS polling', {
        chainId: this.config.chainId,
        pollInterval: this.transactionSettings.listenerPollInterval,
        proverCount: this.proverAddresses.size,
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
    this.isRunning = false;

    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }

    if (this.proverPollingSubscription) {
      this.proverPollingSubscription.unsubscribe();
      this.proverPollingSubscription = null;
    }

    if (this.tronWebClient) {
      this.tronWebClient = null;
    }

    this.logger.warn('TronListener stopped', { chainId: this.config.chainId });
  }

  /**
   * Initialize OpenTelemetry metrics for monitoring
   */
  private initializeMetrics() {
    const meter = this.otelService.getMeter();

    return {
      pollCounter: meter.createCounter(CONSTANTS.METRICS.POLL_COUNT, {
        description: 'Total number of TVM blockchain polls',
      }),
      eventsFoundCounter: meter.createCounter(CONSTANTS.METRICS.EVENTS_FOUND, {
        description: 'Total number of events found in TVM polls',
      }),
      pollDurationHistogram: meter.createHistogram(CONSTANTS.METRICS.POLL_DURATION, {
        description: 'Duration of TVM poll operations',
        unit: 'ms',
      }),
      pollErrorCounter: meter.createCounter(CONSTANTS.METRICS.POLL_ERRORS, {
        description: 'Total number of TVM poll errors',
      }),
      eventProcessingErrorCounter: meter.createCounter(CONSTANTS.METRICS.EVENT_PROCESSING_ERRORS, {
        description: 'Total number of event processing errors',
      }),
    };
  }

  /**
   * Initialize listener components
   */
  private async initialize(): Promise<void> {
    // Validate portal address
    const portalAddressUA = this.tvmConfigService.getPortalAddress(this.config.chainId);
    if (!portalAddressUA) {
      throw new Error(`No Portal address configured for chain ${this.config.chainId}`);
    }

    // Initialize prover addresses
    this.initializeProverAddresses();

    // Create and validate TronWeb client
    this.tronWebClient = this.createTronWebClient();
    await this.validateClientConnection();

    // Get initial timestamp
    await this.initializeLastTimestamp();

    this.isRunning = true;
  }

  /**
   * Initialize prover addresses from configuration
   */
  private initializeProverAddresses(): void {
    const network = this.tvmConfigService.getChain(this.config.chainId);
    const provers = network.provers || {};

    for (const [proverType, proverAddress] of Object.entries(provers)) {
      if (!proverAddress) continue;
      this.proverAddresses.set(proverType, proverAddress);
      this.logger.log(`Registered ${proverType} prover`, { address: proverAddress });
    }
  }

  /**
   * Validate TronWeb client connection
   */
  private async validateClientConnection(): Promise<void> {
    if (!this.tronWebClient) {
      throw new Error('TronWeb client not initialized');
    }

    try {
      const block = await this.tronWebClient.trx.getCurrentBlock();
      if (!block) {
        throw new Error('Failed to fetch current block');
      }
    } catch (error) {
      throw new Error(`Failed to validate TronWeb connection: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Initialize the last processed timestamp
   */
  private async initializeLastTimestamp(): Promise<void> {
    if (!this.tronWebClient) {
      throw new Error('TronWeb client not initialized');
    }

    const currentBlock = await this.tronWebClient.trx.getConfirmedCurrentBlock();
    if (!currentBlock?.block_header?.raw_data?.timestamp) {
      throw new Error('Failed to get initial block timestamp');
    }

    this.lastBlockTimestamp = currentBlock.block_header.raw_data.timestamp;
    this.lastProverBlockTimestamp = currentBlock.block_header.raw_data.timestamp;
    this.logger.log('Initialized last block timestamp', {
      timestamp: this.lastBlockTimestamp,
      proverTimestamp: this.lastProverBlockTimestamp,
      blockNumber: currentBlock.block_header.raw_data.number,
    });
  }

  /**
   * Start RxJS-based polling
   */
  private startRxJSPolling(): void {
    // Start Portal events polling (IntentPublished, IntentFulfilled, etc.)
    this.startPortalEventPolling();

    // Start Prover events polling (IntentProven) with longer interval
    this.startProverEventPolling();
  }

  /**
   * Start polling for Portal events
   */
  private startPortalEventPolling(): void {
    // Create polling observable with retry logic
    const polling$ = pollWithRetry(() => this.pollForPortalEvents(), {
      pollInterval: this.transactionSettings.listenerPollInterval,
      immediate: true,
      ...this.retryConfig,
    });

    // Subscribe to polling observable
    this.pollingSubscription = polling$.subscribe({
      next: (result) => {
        if (result && result.eventsProcessed > 0) {
          this.logger.debug('Portal poll cycle completed', {
            eventsProcessed: result.eventsProcessed,
            errors: result.errors.length,
          });
        }
      },
      error: (error) => {
        // This should rarely happen due to retry logic
        this.logger.error('Fatal portal polling error', toError(error));
        // Attempt to restart polling after a delay
        setTimeout(() => {
          if (this.isRunning) {
            this.logger.log('Attempting to restart portal polling after fatal error');
            this.startPortalEventPolling();
          }
        }, 10000);
      },
    });
  }

  /**
   * Start polling for Prover events with longer interval
   */
  private startProverEventPolling(): void {
    // Skip if no prover addresses configured
    if (this.proverAddresses.size === 0) {
      this.logger.log('No prover addresses configured, skipping prover event polling');
      return;
    }

    // Create polling observable with retry logic and longer interval
    const polling$ = pollWithRetry(() => this.pollForProverEvents(), {
      pollInterval: this.transactionSettings.proverListenerInterval || 60000, // Default 1 minute
      immediate: true,
      ...this.retryConfig,
    });

    // Subscribe to polling observable
    this.proverPollingSubscription = polling$.subscribe({
      next: (result) => {
        if (result && result.eventsProcessed > 0) {
          this.logger.debug('Prover poll cycle completed', {
            eventsProcessed: result.eventsProcessed,
            errors: result.errors.length,
          });
        }
      },
      error: (error) => {
        // This should rarely happen due to retry logic
        this.logger.error('Fatal prover polling error', toError(error));
        // Attempt to restart polling after a delay
        setTimeout(() => {
          if (this.isRunning) {
            this.logger.log('Attempting to restart prover polling after fatal error');
            this.startProverEventPolling();
          }
        }, 10000);
      },
    });
  }

  /**
   * Creates a TronWeb instance with error handling
   */
  private createTronWebClient(): TronWeb {
    try {
      return TvmClientUtils.createClient(this.config);
    } catch (error) {
      throw new Error(`Failed to create TronWeb client: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Poll for Prover events (IntentProven)
   */
  private async pollForProverEvents(): Promise<PollResult> {
    if (!this.isRunning || !this.tronWebClient) {
      return { eventsProcessed: 0, errors: [], lastTimestamp: this.lastProverBlockTimestamp };
    }

    const startTime = Date.now();
    const attributes = {
      'tvm.chain_id': this.config.chainId.toString(),
      'tvm.event_type': 'prover',
    };

    const span = this.otelService.startSpan('tvm.listener.poll.prover', { attributes });

    try {
      this.metrics.pollCounter.add(1, attributes);

      const result = await this.executeProverPollCycle();

      span.setAttributes({
        'tvm.events.processed': result.eventsProcessed,
        'tvm.events.errors': result.errors.length,
        'tvm.last_timestamp': result.lastTimestamp,
      });

      if (result.errors.length > 0) {
        this.metrics.pollErrorCounter.add(result.errors.length, attributes);
        result.errors.forEach((error) => span.recordException(error));
      }

      span.setStatus({ code: api.SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(toError(error));
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      this.metrics.pollDurationHistogram.record(duration, attributes);
      span.end();
    }
  }

  /**
   * Poll for Portal events (IntentPublished, IntentFulfilled, IntentWithdrawn)
   */
  private async pollForPortalEvents(): Promise<PollResult> {
    if (!this.isRunning || !this.tronWebClient) {
      return { eventsProcessed: 0, errors: [], lastTimestamp: this.lastBlockTimestamp };
    }

    const startTime = Date.now();
    const attributes = { 'tvm.chain_id': this.config.chainId.toString() };

    const span = this.otelService.startSpan('tvm.listener.poll', { attributes });

    try {
      this.metrics.pollCounter.add(1, attributes);

      const result = await this.executePortalPollCycle();

      span.setAttributes({
        'tvm.events.processed': result.eventsProcessed,
        'tvm.events.errors': result.errors.length,
        'tvm.last_timestamp': result.lastTimestamp,
      });

      if (result.errors.length > 0) {
        this.metrics.pollErrorCounter.add(result.errors.length, attributes);
        result.errors.forEach((error) => span.recordException(error));
      }

      span.setStatus({ code: api.SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(toError(error));
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      this.metrics.pollDurationHistogram.record(duration, attributes);
      span.end();
    }
  }

  /**
   * Execute a single poll cycle
   */
  private async executePortalPollCycle(): Promise<PollResult> {
    // Fetch events using RxJS retry utility
    const events = await executeWithRetry(() => this.fetchPortalEvents(), this.retryConfig);

    const result: PollResult = {
      eventsProcessed: 0,
      errors: [],
      lastTimestamp: this.lastBlockTimestamp,
    };

    if (!events || events.length === 0) {
      return result;
    }

    this.logEventsFound(events.length, 'portal events');

    // Process events in batches
    const processingResults = await this.processEventsBatch(events);

    result.eventsProcessed = processingResults.filter((r) => r.success).length;
    result.errors = processingResults.filter((r) => !r.success).map((r) => r.error!);

    // Update timestamp only if we successfully processed some events
    if (result.eventsProcessed > 0) {
      result.lastTimestamp = this.calculateNewestTimestamp(events);
      this.lastBlockTimestamp = result.lastTimestamp;
    }

    return result;
  }

  /**
   * Execute a single prover poll cycle
   */
  private async executeProverPollCycle(): Promise<PollResult> {
    // Fetch events using RxJS retry utility
    const events = await executeWithRetry(() => this.fetchProverEvents(), this.retryConfig);

    const result: PollResult = {
      eventsProcessed: 0,
      errors: [],
      lastTimestamp: this.lastProverBlockTimestamp,
    };

    if (!events || events.length === 0) {
      return result;
    }

    this.logEventsFound(events.length, 'prover events');

    // Process events in batches
    const processingResults = await this.processEventsBatch(events);

    result.eventsProcessed = processingResults.filter((r) => r.success).length;
    result.errors = processingResults.filter((r) => !r.success).map((r) => r.error!);

    // Update timestamp only if we successfully processed some events
    if (result.eventsProcessed > 0) {
      result.lastTimestamp = this.calculateNewestTimestamp(events);
      this.lastProverBlockTimestamp = result.lastTimestamp;
    }

    return result;
  }

  /**
   * Fetch portal events from the blockchain
   */
  private async fetchPortalEvents(): Promise<TvmEvent[]> {
    if (!this.tronWebClient) {
      throw new Error('TronWeb client not available');
    }

    const portalAddress = this.tvmConfigService.getTvmPortalAddress(this.config.chainId);
    const minBlockTimestamp = this.lastBlockTimestamp + CONSTANTS.TIMESTAMP_OFFSET_MS;

    const portalEventsResponse = await this.tronWebClient.event.getEventsByContractAddress(
      portalAddress,
      {
        onlyConfirmed: true,
        minBlockTimestamp,
        orderBy: 'block_timestamp,asc',
        limit: CONSTANTS.DEFAULT_EVENT_LIMIT,
      },
    );

    if (!isValidEventResponse(portalEventsResponse)) {
      throw new Error('Invalid event response from TronWeb');
    }

    return portalEventsResponse.data || [];
  }

  /**
   * Fetch prover events (IntentProven) from the blockchain
   */
  private async fetchProverEvents(): Promise<TvmEvent[]> {
    if (!this.tronWebClient) {
      throw new Error('TronWeb client not available');
    }

    const minBlockTimestamp = this.lastProverBlockTimestamp + CONSTANTS.TIMESTAMP_OFFSET_MS;
    const allProverEvents: TvmEvent[] = [];

    // Fetch events from all configured prover addresses
    for (const [proverType, proverAddress] of this.proverAddresses) {
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

        if (isValidEventResponse(proverEventsResponse) && proverEventsResponse.data) {
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
      if (!hasValidEventData(event)) {
        results.push({ success: false, error: new Error('Invalid event data') });
        continue;
      }

      try {
        const result = await this.routeEventProcessing(event, intentFundedTxIds);
        results.push(result);
      } catch (error) {
        results.push({ success: false, error: toError(error) });
        this.metrics.eventProcessingErrorCounter.add(1);
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
        batch.map((txId) =>
          executeWithRetry(() => this.processTransaction(txId), this.retryConfig),
        ),
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
    const span = this.createEventSpan('IntentFulfilled', event);

    try {
      const fulfilledEvent = TvmEventParser.parseTvmIntentFulfilled(
        BigInt(this.config.chainId),
        event,
      );

      const claimant = AddressNormalizer.normalize(
        TvmUtils.fromHex(fulfilledEvent.claimant),
        ChainType.TVM,
      );

      this.emitEventWithContext(span, 'intent.fulfilled', {
        intentHash: fulfilledEvent.intentHash,
        claimant,
        transactionHash: event.transaction_id,
        blockNumber: BigInt(event.block_number || 0),
        timestamp: new Date(event.block_timestamp || 0),
        chainId: BigInt(this.config.chainId),
      });

      span.setStatus({ code: api.SpanStatusCode.OK });
      return { success: true, intentHash: fulfilledEvent.intentHash };
    } catch (error) {
      this.handleEventError(span, error, 'IntentFulfilled');
      return { success: false, error: toError(error) };
    } finally {
      span.end();
    }
  }

  /**
   * Process IntentProven event
   */
  private async processIntentProvenEvent(event: TvmEvent): Promise<ProcessingResult> {
    const span = this.createEventSpan('IntentProven', event);

    try {
      const parsedEvent = TvmEventParser.parseIntentProvenEvent(event, this.config.chainId);

      this.emitEventWithContext(span, 'intent.proven', parsedEvent);

      span.setStatus({ code: api.SpanStatusCode.OK });
      return { success: true, intentHash: parsedEvent.intentHash };
    } catch (error) {
      this.handleEventError(span, error, 'IntentProven');
      return { success: false, error: toError(error) };
    } finally {
      span.end();
    }
  }

  /**
   * Process IntentWithdrawn event
   */
  private async processIntentWithdrawnEvent(event: TvmEvent): Promise<ProcessingResult> {
    const span = this.createEventSpan('IntentWithdrawn', event);

    try {
      const parsedEvent = TvmEventParser.parseIntentWithdrawnEvent(event, this.config.chainId);

      this.emitEventWithContext(span, 'intent.withdrawn', parsedEvent);

      span.setStatus({ code: api.SpanStatusCode.OK });
      return { success: true, intentHash: parsedEvent.intentHash };
    } catch (error) {
      this.handleEventError(span, error, 'IntentWithdrawn');
      return { success: false, error: toError(error) };
    } finally {
      span.end();
    }
  }

  /**
   * Process a transaction to extract IntentPublished events
   */
  private async processTransaction(txId: string): Promise<ProcessingResult> {
    if (!this.tronWebClient) {
      return { success: false, error: new Error('TronWeb client not available') };
    }

    const span = this.otelService.startSpan('tvm.listener.processTransaction', {
      attributes: {
        'tvm.transaction_id': txId,
        'tvm.chain_id': this.config.chainId.toString(),
      },
    });

    try {
      const txInfo = await this.tronWebClient.trx.getTransactionInfo(txId);

      if (!this.hasValidTransactionLogs(txInfo)) {
        span.setStatus({ code: api.SpanStatusCode.OK });
        return { success: true };
      }

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
  }

  /**
   * Check if transaction has valid logs
   */
  private hasValidTransactionLogs(txInfo: any): boolean {
    return txInfo && txInfo.log && Array.isArray(txInfo.log) && txInfo.log.length > 0;
  }

  /**
   * Extract IntentPublished event from transaction logs
   */
  private extractIntentFromTransaction(txInfo: any): Intent | null {
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
    const span = this.otelService.startSpan('tvm.listener.processIntentEvent', {
      attributes: {
        'tvm.intent_hash': intent.intentHash,
        'tvm.chain_id': this.config.chainId.toString(),
      },
    });

    try {
      // Submit intent directly to fulfillment service
      await api.context.with(api.trace.setSpan(api.context.active(), span), async () => {
        try {
          await this.fulfillmentService.submitIntent(intent);
          this.logger.log(`Intent ${intent.intentHash} submitted to fulfillment queue`);
        } catch (error) {
          this.logger.error(`Failed to submit intent ${intent.intentHash}:`, toError(error));
          span.recordException(toError(error));
        }
      });
      span.setStatus({ code: api.SpanStatusCode.OK });

      this.logger.log('Intent discovered', {
        intentHash: intent.intentHash,
        source: this.config.chainId,
        destination: intent.destination.toString(),
      });
    } catch (error) {
      this.handleEventError(span, error, 'IntentPublished');
      throw error;
    } finally {
      span.end();
    }
  }

  // Utility methods

  /**
   * Create a span for event processing
   */
  private createEventSpan(eventName: string, event: TvmEvent): api.Span {
    return this.otelService.startSpan(`tvm.listener.process${eventName}`, {
      attributes: {
        'tvm.chain_id': this.config.chainId.toString(),
        'tvm.event_name': eventName,
        'tvm.transaction_id': event.transaction_id,
        'tvm.block_number': event.block_number?.toString(),
      },
    });
  }

  /**
   * Emit event with OpenTelemetry context
   */
  private emitEventWithContext(span: api.Span, eventName: string, data: any): void {
    api.context.with(api.trace.setSpan(api.context.active(), span), () => {
      // Type assertion is safe here as we only call this with valid event names
      this.eventsService.emit(eventName as any, data);
    });
    span.addEvent(`${eventName}.emitted`);
  }

  /**
   * Handle event processing errors
   */
  private handleEventError(span: api.Span, error: unknown, eventType: string): void {
    const err = toError(error);
    span.recordException(err);
    span.setStatus({ code: api.SpanStatusCode.ERROR });
    this.logger.error(`Error processing ${eventType} event`, err);
  }

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

  /**
   * Log events found for debugging
   */
  private logEventsFound(count: number, type: string = 'events'): void {
    const attributes = { 'tvm.chain_id': this.config.chainId.toString(), 'tvm.event_type': type };
    this.metrics.eventsFoundCounter.add(count, attributes);

    if (count > 0) {
      this.logger.log(`${type} found in poll`, {
        chainId: this.config.chainId,
        eventCount: count,
        eventType: type,
      });
    }
  }
}
