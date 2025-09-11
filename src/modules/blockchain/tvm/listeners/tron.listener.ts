import * as api from '@opentelemetry/api';
import { TronWeb } from 'tronweb';
import { getAbiItem, Hex, toEventHash } from 'viem';

import { portalAbi } from '@/common/abis/portal.abi';
import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType } from '@/common/utils/chain-type-detector';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { minutes } from '@/common/utils/time';
import { TvmNetworkConfig, TvmTransactionSettings } from '@/config/schemas';
import { EvmEventParser } from '@/modules/blockchain/evm/utils/evm-event-parser';
import { TvmEvent, TvmEventResponse } from '@/modules/blockchain/tvm/types/events.type';
import { TvmClientUtils } from '@/modules/blockchain/tvm/utils';
import { TvmEventParser } from '@/modules/blockchain/tvm/utils/tvm-event-parser';
import { TvmUtils } from '@/modules/blockchain/tvm/utils/tvm-utils';
import { TvmConfigService } from '@/modules/config/services';
import { EventsService } from '@/modules/events/events.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

export class TronListener extends BaseChainListener {
  private intervalId: NodeJS.Timeout | null = null;
  private lastBlockTimestamp: number = 0;
  private isRunning: boolean = false;
  private proverAddresses: Map<string, string> = new Map(); // Map of prover type to address

  // Metrics instruments
  private pollCounter: api.Counter;
  private eventsFoundCounter: api.Counter;
  private pollDurationHistogram: api.Histogram;

  constructor(
    private readonly config: TvmNetworkConfig,
    private readonly transactionSettings: TvmTransactionSettings,
    private readonly eventsService: EventsService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    private readonly tvmConfigService: TvmConfigService,
  ) {
    super();
    // Context is already set by the manager when creating the logger instance

    // Initialize metrics
    const meter = this.otelService.getMeter();

    this.pollCounter = meter.createCounter('tvm.poll.count', {
      description: 'Total number of TVM blockchain polls',
    });

    this.eventsFoundCounter = meter.createCounter('tvm.poll.events_found', {
      description: 'Total number of events found in TVM polls',
    });

    this.pollDurationHistogram = meter.createHistogram('tvm.poll.duration', {
      description: 'Duration of TVM poll operations',
      unit: 'ms',
    });
  }

  /**
   * Starts the blockchain listener for monitoring new intents
   */
  async start(): Promise<void> {
    const portalAddressUA = this.tvmConfigService.getPortalAddress(this.config.chainId);
    if (!portalAddressUA) {
      throw new Error(`No Portal address configured for chain ${this.config.chainId}`);
    }

    // Get prover addresses for this network
    const network = this.tvmConfigService.getChain(this.config.chainId);
    const provers = network.provers || {};

    for (const [proverType, proverAddress] of Object.entries(provers)) {
      if (!proverAddress) continue;
      this.proverAddresses.set(proverType, proverAddress);
      this.logger.log(
        `Will listen for IntentProven events from ${proverType} prover at address: ${proverAddress}`,
      );
    }

    const portalAddress = AddressNormalizer.denormalizeToTvm(portalAddressUA);
    this.logger.log(
      `Starting TronListener for chain ${this.config.chainId}, portal address: ${portalAddress}. Listening for IntentPublished, IntentFulfilled, and IntentWithdrawn events from Portal, and IntentProven events from ${this.proverAddresses.size} prover(s).`,
    );

    this.isRunning = true;

    // Get the current block number and timestamp to start from
    const client = this.createTronWebClient();
    const currentBlock = await client.trx.getConfirmedCurrentBlock();
    this.lastBlockTimestamp = currentBlock.block_header.raw_data.timestamp;

    // Start polling for events
    this.intervalId = setInterval(() => {
      this.pollForEvents().catch((error) => {
        this.logger.error(`Error polling for events: ${getErrorMessage(error)}`, toError(error));
      });
    }, this.transactionSettings.listenerPollInterval);
  }

  /**
   * Stops the blockchain listener
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.logger.warn(`TVM listener stopped for chain ${this.config.chainId}`);
  }

  /**
   * Creates a TronWeb instance for this listener
   * @returns TronWeb instance
   */
  private createTronWebClient(): TronWeb {
    return TvmClientUtils.createClient(this.config);
  }

  private async pollForEvents(): Promise<void> {
    if (!this.isRunning) return;

    const startTime = Date.now();
    const attributes = {
      'tvm.chain_id': this.config.chainId.toString(),
    };

    try {
      const client = this.createTronWebClient();

      // Record metrics instead of logging
      this.pollCounter.add(1, attributes);

      const portalAddress = this.tvmConfigService.getTvmPortalAddress(this.config.chainId);

      // Add a second to not get the last blocks events
      const minBlockTimestamp = this.lastBlockTimestamp + minutes(1);

      // Get Portal events (IntentFunded, IntentFulfilled, IntentWithdrawn)
      // Note: IntentPublished events will be fetched from transaction info of IntentFunded events
      const portalEventsResponse: TvmEventResponse = await client.event.getEventsByContractAddress(
        portalAddress,
        {
          onlyConfirmed: true,
          minBlockTimestamp,
          orderBy: 'block_timestamp,asc',
          limit: 200,
        },
      );

      // TODO: Listener for IntentProven events must have a different interval
      // Get IntentProven events from all configured prover contracts
      const allProverEvents: TvmEventResponse['data'] = [];
      // for (const [proverType, proverAddress] of this.proverAddresses.entries()) {
      //   try {
      //     const proverEventsResponse = await client.event.getEventsByContractAddress(
      //       proverAddress,
      //       {
      //         onlyConfirmed: true,
      //         minBlockTimestamp: this.lastBlockTimestamp,
      //         orderBy: 'block_timestamp,asc',
      //         limit: 200,
      //       },
      //     );
      //
      //     if ((proverEventsResponse.data?.length || 0) > 0) {
      //       allProverEvents.push(...proverEventsResponse.data!);
      //     }
      //   } catch (error) {
      //     this.logger.error(
      //       `Error fetching events from ${proverType} prover at ${proverAddress}: ${getErrorMessage(error)}`,
      //       toError(error),
      //     );
      //   }
      // }

      // Combine all events
      const events: TvmEventResponse['data'] = [
        ...(portalEventsResponse.data || []),
        ...allProverEvents,
      ];

      const eventCount = events.length;
      if (eventCount > 0) {
        // Record events found in metrics
        this.eventsFoundCounter.add(eventCount, attributes);

        // Keep this log as it's important for debugging
        this.logger.log('Found events in poll', {
          chainId: this.config.chainId,
          eventCount,
        });
      }

      // Collect unique transaction IDs from IntentFunded events
      const intentFundedTxIds = new Set<string>();

      // Process events and collect IntentFunded transaction IDs
      for (const event of events) {
        if (event.event_name === 'IntentFunded') {
          // Collect transaction ID for fetching IntentPublished event
          intentFundedTxIds.add(event.transaction_id);
        } else if (event.event_name === 'IntentFulfilled') {
          await this.processIntentFulfilledEvent(event);
        } else if (event.event_name === 'IntentProven') {
          // Pass prover type if available (from prover contracts)
          await this.processIntentProvenEvent(event);
        } else if (event.event_name === 'IntentWithdrawn') {
          await this.processIntentWithdrawnEvent(event);
        }
      }

      // Fetch and process IntentPublished events from transactions
      for (const txId of intentFundedTxIds) {
        await this.processTransaction(txId, client);
      }

      // Use the lastest fetched event, to get the last verified block's timestamp
      const newestEvent = events.reduce(
        (current, event) =>
          current && current.block_timestamp < event.block_timestamp ? event : current,
        events[0],
      );

      // Update last processed block and timestamp
      this.lastBlockTimestamp = newestEvent?.block_timestamp ?? this.lastBlockTimestamp;
    } catch (error) {
      this.logger.error(`Error polling for events: ${getErrorMessage(error)}`, toError(error));
      throw error;
    } finally {
      // Record poll duration
      const duration = Date.now() - startTime;
      this.pollDurationHistogram.record(duration, attributes);
    }
  }

  private async processIntentEvent(intent: Intent): Promise<void> {
    const span = this.otelService.startSpan('tvm.listener.processIntentEvent', {
      attributes: {
        'tvm.chain_id': this.config.chainId.toString(),
        'tvm.event_name': 'IntentPublished',
        'tvm.transaction_id': intent.publishTxHash,
      },
    });

    try {
      span.setAttributes({
        'tvm.intent_id': intent.intentHash,
        'tvm.source_chain': this.config.chainId.toString(),
        'tvm.destination_chain': intent.destination.toString(),
        'tvm.creator': AddressNormalizer.denormalizeToTvm(intent.reward.creator),
        'tvm.prover': AddressNormalizer.denormalizeToTvm(intent.reward.prover),
      });

      // Emit the intent event within the span context to propagate trace context
      api.context.with(api.trace.setSpan(api.context.active(), span), () => {
        this.eventsService.emit('intent.discovered', { intent });
      });

      span.addEvent('intent.emitted');
      span.setStatus({ code: api.SpanStatusCode.OK });

      this.logger.log(`Intent discovered: ${intent.intentHash}`);
    } catch (error) {
      this.logger.error(`Error processing intent event: ${getErrorMessage(error)}`, toError(error));
      span.recordException(toError(error));
      span.setStatus({ code: api.SpanStatusCode.ERROR });
    } finally {
      span.end();
    }
  }

  private async processIntentFulfilledEvent(event: TvmEvent): Promise<void> {
    const span = this.otelService.startSpan('tvm.listener.processIntentFulfilledEvent', {
      attributes: {
        'tvm.chain_id': this.config.chainId.toString(),
        'tvm.event_name': event.event_name,
        'tvm.transaction_id': event.transaction_id,
        'tvm.block_number': event.block_number,
      },
    });

    try {
      // Parse the IntentFulfilled event
      const fulfilledEvent = TvmEventParser.parseTvmIntentFulfilled(
        BigInt(this.config.chainId),
        event,
      );
      const claimant = AddressNormalizer.normalize(
        TvmUtils.fromHex(fulfilledEvent.claimant),
        ChainType.TVM,
      );

      span.setAttributes({
        'tvm.intent_hash': fulfilledEvent.intentHash,
        'tvm.claimant': claimant,
      });

      // Emit the event within the span context to propagate trace context
      api.context.with(api.trace.setSpan(api.context.active(), span), () => {
        this.eventsService.emit('intent.fulfilled', {
          intentHash: fulfilledEvent.intentHash,
          claimant,
          transactionHash: event.transaction_id,
          blockNumber: BigInt(event.block_number || 0),
          timestamp: new Date(event.block_timestamp || 0),
          chainId: BigInt(this.config.chainId),
        });
      });

      span.addEvent('intent.fulfilled.emitted');
      span.setStatus({ code: api.SpanStatusCode.OK });

      this.logger.log(
        `IntentFulfilled event processed: ${fulfilledEvent.intentHash} on chain ${this.config.chainId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing IntentFulfilled event: ${getErrorMessage(error)}`,
        toError(error),
      );
      span.recordException(toError(error));
      span.setStatus({ code: api.SpanStatusCode.ERROR });
    } finally {
      span.end();
    }
  }

  private async processIntentProvenEvent(event: TvmEvent): Promise<void> {
    const span = this.otelService.startSpan('tvm.listener.processIntentProvenEvent', {
      attributes: {
        'tvm.chain_id': this.config.chainId.toString(),
        'tvm.event_name': event.event_name,
        'tvm.transaction_id': event.transaction_id,
        'tvm.block_number': event.block_number,
      },
    });

    try {
      const parsedEvent = TvmEventParser.parseIntentProvenEvent(event, this.config.chainId);
      const { intentHash, claimant } = parsedEvent;

      span.setAttributes({
        'tvm.intent_hash': intentHash,
        'tvm.claimant': claimant,
      });

      // Emit the event within the span context to propagate trace context
      api.context.with(api.trace.setSpan(api.context.active(), span), () => {
        this.eventsService.emit('intent.proven', parsedEvent);
      });

      span.addEvent('intent.proven.emitted');
      span.setStatus({ code: api.SpanStatusCode.OK });

      this.logger.log(
        `IntentProven event processed: ${intentHash} on chain ${this.config.chainId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing IntentProven event: ${getErrorMessage(error)}`,
        toError(error),
      );
      span.recordException(toError(error));
      span.setStatus({ code: api.SpanStatusCode.ERROR });
    } finally {
      span.end();
    }
  }

  private async processIntentWithdrawnEvent(event: TvmEvent): Promise<void> {
    const span = this.otelService.startSpan('tvm.listener.processIntentWithdrawnEvent', {
      attributes: {
        'tvm.chain_id': this.config.chainId.toString(),
        'tvm.event_name': event.event_name,
        'tvm.transaction_id': event.transaction_id,
        'tvm.block_number': event.block_number,
      },
    });

    try {
      const parsedEvent = TvmEventParser.parseIntentWithdrawnEvent(event, this.config.chainId);
      const { intentHash, claimant } = parsedEvent;

      span.setAttributes({
        'tvm.intent_hash': intentHash,
        'tvm.claimant': claimant,
      });

      // Emit the event within the span context to propagate trace context
      api.context.with(api.trace.setSpan(api.context.active(), span), () => {
        this.eventsService.emit('intent.withdrawn', parsedEvent);
      });

      span.addEvent('intent.withdrawn.emitted');
      span.setStatus({ code: api.SpanStatusCode.OK });

      this.logger.log(
        `IntentWithdrawn event processed: ${intentHash} on chain ${this.config.chainId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing IntentWithdrawn event: ${getErrorMessage(error)}`,
        toError(error),
      );
      span.recordException(toError(error));
      span.setStatus({ code: api.SpanStatusCode.ERROR });
    } finally {
      span.end();
    }
  }

  /**
   * Retrieves transaction info and extracts events
   * @param txId - The transaction ID to fetch info for
   * @param client - TronWeb client instance
   * @returns Decoded IntentPublished event data or null if not found
   */
  private async processTransaction(txId: string, client: TronWeb) {
    try {
      // Fetch transaction info
      const txInfo = await client.trx.getTransactionInfo(txId);

      if (!txInfo || !txInfo.log || !Array.isArray(txInfo.log)) {
        return;
      }

      const intentPublishedEventHash = toEventHash(
        getAbiItem({ abi: portalAbi, name: 'IntentPublished' }),
      );

      // Iterate through logs to find IntentPublished event
      for (const log of txInfo.log) {
        // Ensure topics have '0x' prefix for Viem
        const topics = log.topics.map((topic: string) =>
          topic.startsWith('0x') ? topic : `0x${topic}`,
        ) as [Hex, ...Hex[]];

        // Filter IntentPublished events using its event hash
        if (topics[0] !== intentPublishedEventHash) {
          // Skip other events.
          continue;
        }

        // Ensure data has '0x' prefix for Viem
        const data = log.data?.startsWith('0x') ? log.data : `0x${log.data || ''}`;

        const evmLog = { topics, data: data as Hex };

        const intent = EvmEventParser.parseIntentPublish(BigInt(this.config.chainId), evmLog);
        // Add the transaction hash to the intent
        intent.publishTxHash = txInfo.id;

        await this.processIntentEvent(intent);
      }
    } catch (error) {
      this.logger.error(
        `Error fetching transaction info for ${txId}: ${getErrorMessage(error)}`,
        toError(error),
      );
    }
  }
}
