import { EventEmitter2 } from '@nestjs/event-emitter';

import * as api from '@opentelemetry/api';
import { TronWeb } from 'tronweb';

import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { PortalEncoder } from '@/common/utils/portal-encoder';
import { TvmNetworkConfig, TvmTransactionSettings } from '@/config/schemas';
import { TvmUtilsService } from '@/modules/blockchain/tvm/services/tvm-utils.service';
import { TvmClientUtils } from '@/modules/blockchain/tvm/utils';
import { BlockchainConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

export class TronListener extends BaseChainListener {
  private intervalId: NodeJS.Timeout | null = null;
  private lastBlockNumber: number = 0;
  private isRunning: boolean = false;

  // Metrics instruments
  private pollCounter: api.Counter;
  private blocksProcessedHistogram: api.Histogram;
  private eventsFoundCounter: api.Counter;
  private lastBlockGauge: api.UpDownCounter;
  private pollDurationHistogram: api.Histogram;

  constructor(
    private readonly config: TvmNetworkConfig,
    private readonly transactionSettings: TvmTransactionSettings,
    private readonly utilsService: TvmUtilsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    private readonly blockchainConfigService: BlockchainConfigService,
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
    const portalAddress = this.blockchainConfigService.getPortalAddress(this.config.chainId);
    if (!portalAddress) {
      throw new Error(`No Portal address configured for chain ${this.config.chainId}`);
    }

    this.logger.log(
      `Starting TronListener for chain ${this.config.chainId}, portal address: ${portalAddress}`,
    );

    this.isRunning = true;

    // Get the current block number to start from
    const client = this.createTronWebClient();
    const currentBlock = await client.trx.getCurrentBlock();
    this.lastBlockNumber = currentBlock.block_header.raw_data.number;

    // Start polling for events
    this.intervalId = setInterval(() => {
      this.pollForEvents().catch((error) => {
        this.logger.error(`Error polling for events: ${error.message}`, error);
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

      const portalAddress = this.blockchainConfigService.getPortalAddress(this.config.chainId);
      // Convert address to hex for event filtering
      const hexPortalAddress = portalAddress.startsWith('T')
        ? this.utilsService.toHex(portalAddress)
        : portalAddress;

      // Get events from the last processed block to current
      const events = await client.event.getEventsByContractAddress(hexPortalAddress, {
        onlyConfirmed: true,
        minBlockTimestamp: this.lastBlockNumber,
        orderBy: 'block_timestamp,asc',
        limit: 200,
      });

      const eventCount = events && Array.isArray(events) ? events.length : 0;
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

      // Process IntentPublished events
      if (events && Array.isArray(events)) {
        for (const event of events) {
          if (event.event_name === 'IntentPublished') {
            await this.processIntentEvent(event);
          }
        }
      }

      // Update last processed block
      this.lastBlockNumber = currentBlockNumber;
    } catch (error) {
      this.logger.error(`Error polling for events: ${error.message}`, error);
      throw error;
    } finally {
      // Record poll duration
      const duration = Date.now() - startTime;
      this.pollDurationHistogram.record(duration, attributes);
    }
  }

  private async processIntentEvent(event: any): Promise<void> {
    const span = this.otelService.startSpan('tvm.listener.processIntentEvent', {
      attributes: {
        'tvm.chain_id': this.config.chainId.toString(),
        'tvm.event_name': event.event_name,
        'tvm.transaction_id': event.transaction_id,
        'tvm.block_number': event.block_number,
      },
    });

    // Helper to serialize objects with BigInt
    const serializeWithBigInt = (obj: any) =>
      JSON.stringify(obj, (_, value) => (typeof value === 'bigint' ? value.toString() : value));

    this.logger.log(serializeWithBigInt(event));

    try {
      // Parse event result
      const result = event.result;

      // Decode route based on destination chain type
      const destChainType = ChainTypeDetector.detect(BigInt(result.destination));
      const route = PortalEncoder.decodeFromChain(
        Buffer.from(result.route, 'hex'),
        destChainType,
        'route',
      ) as any;

      // Construct intent from Portal event data
      const intent = {
        intentHash: result.hash,
        destination: BigInt(result.destination),
        route: {
          salt: route.salt,
          deadline: route.deadline,
          portal: route.portal,
          tokens: route.tokens || [],
          calls: route.calls || [],
        },
        reward: {
          creator: this.utilsService.fromHex(result.creator),
          prover: this.utilsService.fromHex(result.prover),
          deadline: BigInt(result.rewardDeadline),
          nativeAmount: BigInt(result.nativeAmount),
          tokens: result.rewardTokens ? this.parseTokenArray(result.rewardTokens) : [],
        },
        sourceChainId: BigInt(this.config.chainId),
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
        this.eventEmitter.emit('intent.discovered', { intent, strategy: 'standard' });
      });

      span.addEvent('intent.emitted');
      span.setStatus({ code: api.SpanStatusCode.OK });

      this.logger.log(`Intent discovered: ${intent.intentHash}`);
    } catch (error) {
      this.logger.error(`Error processing intent event: ${error.message}`, error);
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
    } finally {
      span.end();
    }
  }

  private parseTokenArray(tokens: any[]): Array<{ token: string; amount: bigint }> {
    if (!tokens || !Array.isArray(tokens)) {
      return [];
    }

    return tokens.map((token) => ({
      token: this.utilsService.fromHex(token.token),
      amount: BigInt(token.amount),
    }));
  }

  private parseCallArray(calls: any[]): Array<{ target: string; value: bigint; data: string }> {
    if (!calls || !Array.isArray(calls)) {
      return [];
    }

    return calls.map((call) => ({
      target: this.utilsService.fromHex(call.target),
      value: BigInt(call.value),
      data: call.data,
    }));
  }
}
