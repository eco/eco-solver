import * as api from '@opentelemetry/api';
import { TronWeb } from 'tronweb';
import { Hex } from 'viem';

import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { TvmEvent, TvmEventResponse } from '@/common/interfaces/events.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType, ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { PortalEncoder } from '@/common/utils/portal-encoder';
import { TvmNetworkConfig, TvmTransactionSettings } from '@/config/schemas';
import { TvmUtilsService } from '@/modules/blockchain/tvm/services/tvm-utils.service';
import { TvmClientUtils } from '@/modules/blockchain/tvm/utils';
import { parseTvmIntentFulfilled } from '@/modules/blockchain/tvm/utils/events.utils';
import { TvmConfigService } from '@/modules/config/services';
import { EventsService } from '@/modules/events/events.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

export class TronListener extends BaseChainListener {
  private intervalId: NodeJS.Timeout | null = null;
  private lastBlockNumber: number = 0;
  private lastBlockTimestamp: number = 0;
  private isRunning: boolean = false;
  private proverAddresses: Map<string, string> = new Map(); // Map of prover type to address

  // Metrics instruments
  private pollCounter: api.Counter;
  private blocksProcessedHistogram: api.Histogram;
  private eventsFoundCounter: api.Counter;
  private lastBlockGauge: api.UpDownCounter;
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

    this.blocksProcessedHistogram = meter.createHistogram('tvm.poll.blocks_processed', {
      description: 'Number of blocks processed per poll',
      unit: 'blocks',
    });

    this.eventsFoundCounter = meter.createCounter('tvm.poll.events_found', {
      description: 'Total number of events found in TVM polls',
    });

    this.lastBlockGauge = meter.createUpDownCounter('tvm.poll.last_block', {
      description: 'Last processed block number',
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
    const portalAddress = this.tvmConfigService.getPortalAddress(this.config.chainId);
    if (!portalAddress) {
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

    this.logger.log(
      `Starting TronListener for chain ${this.config.chainId}, portal address: ${portalAddress}. Listening for IntentPublished, IntentFulfilled, and IntentWithdrawn events from Portal, and IntentProven events from ${this.proverAddresses.size} prover(s).`,
    );

    this.isRunning = true;

    // Get the current block number and timestamp to start from
    const client = this.createTronWebClient();
    const currentBlock = await client.trx.getCurrentBlock();
    this.lastBlockNumber = currentBlock.block_header.raw_data.number;
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

      // Get current block
      const currentBlock = await client.trx.getCurrentBlock();
      const currentBlockNumber = currentBlock.block_header.raw_data.number;

      // Record metrics instead of logging
      this.pollCounter.add(1, attributes);
      this.lastBlockGauge.add(currentBlockNumber - this.lastBlockNumber, attributes);

      // If no new blocks, skip
      if (currentBlockNumber <= this.lastBlockNumber) {
        // Record zero blocks processed
        this.blocksProcessedHistogram.record(0, attributes);
        return;
      }

      // Record blocks processed
      const blocksProcessed = currentBlockNumber - this.lastBlockNumber;
      this.blocksProcessedHistogram.record(blocksProcessed, attributes);

      const portalAddress = this.tvmConfigService.getTvmPortalAddress(this.config.chainId);

      // {
      //   "data": [
      //   {
      //     "block_number": 57652937,
      //     "block_timestamp": 1756892487000,
      //     "caller_contract_address": "TKWwVSTacc9iToWgfef6cbkXPiBAKeSX2t",
      //     "contract_address": "TKWwVSTacc9iToWgfef6cbkXPiBAKeSX2t",
      //     "event_index": 0,
      //     "event_name": "IntentFulfilled",
      //     "result": {
      //       "0": "c26a03b111c0327b19816e94a1d4818f417c73bcc130576a6105ccb2a5a06cfa",
      //       "1": "000000000000000000000000479b996f6323cf269b45dc642b2fa1722baa84c3",
      //       "intentHash": "c26a03b111c0327b19816e94a1d4818f417c73bcc130576a6105ccb2a5a06cfa",
      //       "claimant": "000000000000000000000000479b996f6323cf269b45dc642b2fa1722baa84c3"
      //     },
      //     "result_type": {
      //       "intentHash": "bytes32",
      //       "claimant": "bytes32"
      //     },
      //     "event": "IntentFulfilled(bytes32 indexed intentHash, bytes32 indexed claimant)",
      //     "transaction_id": "10d1b80be3be07959b0be011c846abddf6cbc08f55719ed2e1acd43d80533083"
      //   },
      //   {
      //     "block_number": 57652937,
      //     "block_timestamp": 1756892487000,
      //     "caller_contract_address": "TKWwVSTacc9iToWgfef6cbkXPiBAKeSX2t",
      //     "contract_address": "TKWwVSTacc9iToWgfef6cbkXPiBAKeSX2t",
      //     "event_index": 4,
      //     "event_name": "IntentProven",
      //     "result": {
      //       "0": "c26a03b111c0327b19816e94a1d4818f417c73bcc130576a6105ccb2a5a06cfa",
      //       "1": "000000000000000000000000479b996f6323cf269b45dc642b2fa1722baa84c3",
      //       "intentHash": "c26a03b111c0327b19816e94a1d4818f417c73bcc130576a6105ccb2a5a06cfa",
      //       "claimant": "000000000000000000000000479b996f6323cf269b45dc642b2fa1722baa84c3"
      //     },
      //     "result_type": {
      //       "intentHash": "bytes32",
      //       "claimant": "bytes32"
      //     },
      //     "event": "IntentProven(bytes32 indexed intentHash, bytes32 indexed claimant)",
      //     "transaction_id": "10d1b80be3be07959b0be011c846abddf6cbc08f55719ed2e1acd43d80533083"
      //   }
      // ],
      //     "success": true,
      //     "meta": {
      //   "at": 1756892865144,
      //       "page_size": 2
      // }
      // }

      // Get Portal events (IntentPublished, IntentFulfilled, IntentWithdrawn)
      const portalEventsResponse: TvmEventResponse = await client.event.getEventsByContractAddress(
        portalAddress,
        {
          onlyConfirmed: true,
          minBlockTimestamp: this.lastBlockTimestamp,
          orderBy: 'block_timestamp,asc',
          limit: 200,
        },
      );

      // Get IntentProven events from all configured prover contracts
      const allProverEvents: TvmEventResponse['data'] = [];
      for (const [proverType, proverAddress] of this.proverAddresses.entries()) {
        try {
          const proverEventsResponse = await client.event.getEventsByContractAddress(
            proverAddress,
            {
              onlyConfirmed: true,
              minBlockTimestamp: this.lastBlockTimestamp,
              orderBy: 'block_timestamp,asc',
              limit: 200,
            },
          );

          if ((proverEventsResponse.data?.length || 0) > 0) {
            allProverEvents.push(...proverEventsResponse.data!);
          }
        } catch (error) {
          this.logger.error(
            `Error fetching events from ${proverType} prover at ${proverAddress}: ${getErrorMessage(error)}`,
            toError(error),
          );
        }
      }

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
          blockRange: `${this.lastBlockNumber}-${currentBlockNumber}`,
        });
      }

      // Process events
      for (const event of events) {
        if (event.event_name === 'IntentPublished') {
          await this.processIntentEvent(event);
        } else if (event.event_name === 'IntentFulfilled') {
          await this.processIntentFulfilledEvent(event);
        } else if (event.event_name === 'IntentProven') {
          // Pass prover type if available (from prover contracts)
          await this.processIntentProvenEvent(event);
        } else if (event.event_name === 'IntentWithdrawn') {
          await this.processIntentWithdrawnEvent(event);
        }
      }

      // Update last processed block and timestamp
      this.lastBlockNumber = currentBlockNumber;
      this.lastBlockTimestamp = currentBlock.block_header.raw_data.timestamp;
    } catch (error) {
      this.logger.error(`Error polling for events: ${getErrorMessage(error)}`, toError(error));
      throw error;
    } finally {
      // Record poll duration
      const duration = Date.now() - startTime;
      this.pollDurationHistogram.record(duration, attributes);
    }
  }

  private async processIntentEvent(event: TvmEvent): Promise<void> {
    const span = this.otelService.startSpan('tvm.listener.processIntentEvent', {
      attributes: {
        'tvm.chain_id': this.config.chainId.toString(),
        'tvm.event_name': event.event_name,
        'tvm.transaction_id': event.transaction_id,
        'tvm.block_number': event.block_number,
      },
    });

    try {
      // Parse event result
      const result = event.result;

      // Decode route based on destination chain type - already returns Intent format
      const destChainType = ChainTypeDetector.detect(BigInt(result.destination));
      const route = PortalEncoder.decodeFromChain(
        Buffer.from(result.route, 'hex'),
        destChainType,
        'route',
      );

      // Construct intent from Portal event data with normalized addresses
      const intent = {
        intentHash: result.hash as Hex,
        destination: BigInt(result.destination),
        route, // Already in Intent format with UniversalAddress from PortalEncoder
        reward: {
          creator: AddressNormalizer.normalize(
            TvmUtilsService.fromHex(result.creator),
            ChainType.TVM,
          ),
          prover: AddressNormalizer.normalize(
            TvmUtilsService.fromHex(result.prover),
            ChainType.TVM,
          ),
          deadline: BigInt(result.rewardDeadline),
          nativeAmount: BigInt(result.nativeAmount),
          tokens: result.rewardTokens ? this.parseTokenArray(result.rewardTokens as any) : [],
        },
        sourceChainId: BigInt(this.config.chainId),
        publishTxHash: event.transaction_id,
      };

      span.setAttributes({
        'tvm.intent_id': intent.intentHash,
        'tvm.source_chain': this.config.chainId.toString(),
        'tvm.destination_chain': result.destination,
        'tvm.creator': intent.reward.creator,
        'tvm.prover': intent.reward.prover,
      });

      // Emit the intent event within the span context to propagate trace context
      api.context.with(api.trace.setSpan(api.context.active(), span), () => {
        this.eventsService.emit('intent.discovered', { intent, strategy: 'standard' });
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
      const fulfilledEvent = parseTvmIntentFulfilled(BigInt(this.config.chainId), event);
      const claimant = AddressNormalizer.normalize(
        TvmUtilsService.fromHex(fulfilledEvent.claimant),
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
          txHash: event.transaction_id,
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
    const spanAttributes: any = {
      'tvm.chain_id': this.config.chainId.toString(),
      'tvm.event_name': event.event_name,
      'tvm.transaction_id': event.transaction_id,
      'tvm.block_number': event.block_number,
    };

    const span = this.otelService.startSpan('tvm.listener.processIntentProvenEvent', {
      attributes: spanAttributes,
    });

    try {
      // Parse event result
      const result = event.result;
      const intentHash = result.intentHash || result.hash;
      const claimant = AddressNormalizer.normalize(
        TvmUtilsService.fromHex(result.claimant),
        ChainType.TVM,
      );

      span.setAttributes({
        'tvm.intent_hash': intentHash,
        'tvm.claimant': claimant,
      });

      // Emit the event within the span context to propagate trace context
      api.context.with(api.trace.setSpan(api.context.active(), span), () => {
        this.eventsService.emit('intent.proven', {
          intentHash,
          claimant,
          txHash: event.transaction_id,
          blockNumber: BigInt(event.block_number || 0),
          timestamp: new Date(event.block_timestamp || 0),
          chainId: BigInt(this.config.chainId),
        });
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
      // Parse event result
      const result = event.result;
      const intentHash = result.intentHash || result.hash;
      const claimant = AddressNormalizer.normalize(
        TvmUtilsService.fromHex(result.claimant),
        ChainType.TVM,
      );

      span.setAttributes({
        'tvm.intent_hash': intentHash,
        'tvm.claimant': claimant,
      });

      // Emit the event within the span context to propagate trace context
      api.context.with(api.trace.setSpan(api.context.active(), span), () => {
        this.eventsService.emit('intent.withdrawn', {
          intentHash,
          claimant,
          txHash: event.transaction_id,
          blockNumber: BigInt(event.block_number || 0),
          timestamp: new Date(event.block_timestamp || 0),
          chainId: BigInt(this.config.chainId),
        });
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

  private parseTokenArray(tokens: any[]): Array<{ token: any; amount: bigint }> {
    if (!tokens || !Array.isArray(tokens)) {
      return [];
    }

    return tokens.map((token) => ({
      token: AddressNormalizer.normalize(TvmUtilsService.fromHex(token.token), ChainType.TVM),
      amount: BigInt(token.amount),
    }));
  }
}
