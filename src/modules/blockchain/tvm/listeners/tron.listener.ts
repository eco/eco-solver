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
    this.logger.setContext(`${TronListener.name}:${config.chainId}`);
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

    const span = this.otelService.startSpan('tvm.listener.pollForEvents', {
      attributes: {
        'tvm.chain_id': this.config.chainId.toString(),
        'portal.address': this.blockchainConfigService.getPortalAddress(this.config.chainId),
        'tvm.last_block_number': this.lastBlockNumber,
      },
    });

    try {
      const client = this.createTronWebClient();

      // Get current block
      const currentBlock = await client.trx.getCurrentBlock();
      const currentBlockNumber = currentBlock.block_header.raw_data.number;

      span.setAttribute('tvm.current_block_number', currentBlockNumber);

      // If no new blocks, skip
      if (currentBlockNumber <= this.lastBlockNumber) {
        span.addEvent('tvm.no_new_blocks');
        span.setStatus({ code: api.SpanStatusCode.OK });
        return;
      }

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

      span.setAttribute('tvm.event_count', events && Array.isArray(events) ? events.length : 0);

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
      span.setAttribute('tvm.updated_last_block', this.lastBlockNumber);

      span.setStatus({ code: api.SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
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
        intentId: result.hash,
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
          nativeAmount: BigInt(result.nativeValue),
          tokens: result.rewardTokens ? this.parseTokenArray(result.rewardTokens) : [],
        },
        sourceChainId: BigInt(this.config.chainId),
      };

      span.setAttributes({
        'tvm.intent_id': intent.intentId,
        'tvm.source_chain': this.config.chainId.toString(),
        'tvm.destination_chain': result.destination,
        'tvm.creator': intent.reward.creator,
        'tvm.prover': intent.reward.prover,
      });

      // Emit the intent event
      this.eventEmitter.emit('intent.discovered', { intent, strategy: 'standard' });

      span.addEvent('intent.emitted');
      span.setStatus({ code: api.SpanStatusCode.OK });

      this.logger.log(`Intent discovered: ${intent.intentId}`);
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
