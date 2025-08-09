import { EventEmitter2 } from '@nestjs/event-emitter';

import { IntentSourceAbi } from '@eco-foundation/routes-ts';
import * as api from '@opentelemetry/api';
import { PublicClient } from 'viem';

import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

export class ChainListener extends BaseChainListener {
  private unsubscribe: ReturnType<PublicClient['watchContractEvent']>;

  constructor(
    private readonly config: EvmChainConfig,
    private readonly transportService: EvmTransportService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
  ) {
    super();
    this.logger.setContext(`${ChainListener.name}:${config.chainId}`);
  }

  async start(): Promise<void> {
    const evmConfig = this.config as EvmChainConfig;

    const publicClient = this.transportService.getPublicClient(evmConfig.chainId);

    this.logger.log(
      `Listening for IntentCreated events, intent source: ${evmConfig.intentSourceAddress}`,
    );

    this.unsubscribe = publicClient.watchContractEvent({
      abi: IntentSourceAbi,
      eventName: 'IntentCreated',
      address: evmConfig.intentSourceAddress,
      strict: true,
      onLogs: (logs) => {
        logs.forEach((log) => {
          const span = this.otelService.startSpan('evm.listener.processIntentEvent', {
            attributes: {
              'evm.chain_id': this.config.chainId,
              'evm.event_name': 'IntentCreated',
              'evm.intent_source_address': evmConfig.intentSourceAddress,
              'evm.block_number': log.blockNumber?.toString(),
              'evm.transaction_hash': log.transactionHash,
            },
          });

          try {
            const intent = {
              intentHash: log.args.hash,
              reward: {
                prover: log.args.prover,
                creator: log.args.creator,
                deadline: log.args.deadline,
                nativeValue: log.args.nativeValue,
                tokens: log.args.rewardTokens,
              },
              route: {
                source: log.args.source,
                destination: log.args.destination,
                salt: log.args.salt,
                inbox: log.args.inbox,
                calls: log.args.calls,
                tokens: log.args.routeTokens,
              },
            };

            span.setAttributes({
              'evm.intent_id': intent.intentHash,
              'evm.source_chain': log.args.source.toString(),
              'evm.destination_chain': log.args.destination.toString(),
              'evm.creator': log.args.creator,
              'evm.prover': log.args.prover,
            });

            this.eventEmitter.emit('intent.discovered', { intent, strategy: 'standard' });

            span.addEvent('intent.emitted');
            span.setStatus({ code: api.SpanStatusCode.OK });
          } catch (error) {
            this.logger.error(`Error processing intent event: ${error.message}`, error);
            span.recordException(error as Error);
            span.setStatus({ code: api.SpanStatusCode.ERROR });
          } finally {
            span.end();
          }
        });
      },
    });
  }

  async stop(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.logger.warn(`EVM listener stopped for chain ${this.config.chainId}`);
  }
}
