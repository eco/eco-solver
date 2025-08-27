import { EventEmitter2 } from '@nestjs/event-emitter';

import * as api from '@opentelemetry/api';
import { Address, PublicClient } from 'viem';

import { PortalAbi } from '@/common/abis/portal.abi';
import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { PortalEncoder } from '@/common/utils/portal-encoder';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';
import { BlockchainConfigService } from '@/modules/config/services';
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
    private readonly blockchainConfigService: BlockchainConfigService,
  ) {
    super();
    this.logger.setContext(`${ChainListener.name}:${config.chainId}`);
  }

  async start(): Promise<void> {
    const evmConfig = this.config as EvmChainConfig;

    const publicClient = this.transportService.getPublicClient(evmConfig.chainId);

    const portalAddress = this.blockchainConfigService.getPortalAddress(evmConfig.chainId);
    if (!portalAddress) {
      throw new Error(`No Portal address configured for chain ${evmConfig.chainId}`);
    }

    this.logger.log(`Listening for IntentPublished events, portal address: ${portalAddress}`);

    this.unsubscribe = publicClient.watchContractEvent({
      abi: PortalAbi,
      eventName: 'IntentPublished',
      address: portalAddress as Address,
      strict: true,
      onLogs: (logs) => {
        logs.forEach((log) => {
          const span = this.otelService.startSpan('evm.listener.processIntentEvent', {
            attributes: {
              'evm.chain_id': this.config.chainId,
              'evm.event_name': 'IntentPublished',
              'portal.address': portalAddress,
              'evm.block_number': log.blockNumber?.toString(),
              'evm.transaction_hash': log.transactionHash,
            },
          });

          try {
            // Decode route based on destination chain type
            const destChainType = ChainTypeDetector.detect(log.args.destination);
            const route = PortalEncoder.decodeFromChain(log.args.route, destChainType, 'route');

            const intent = {
              intentHash: log.args.intentHash,
              destination: log.args.destination,
              route: {
                salt: route.salt,
                deadline: route.deadline,
                portal: route.portal,
                tokens: route.tokens,
                calls: route.calls,
              },
              reward: {
                deadline: log.args.rewardDeadline,
                creator: log.args.creator,
                prover: log.args.prover,
                nativeAmount: log.args.rewardNativeAmount,
                tokens: log.args.rewardTokens,
              },
              sourceChainId: BigInt(evmConfig.chainId),
            };

            span.setAttributes({
              'evm.intent_id': intent.intentHash,
              'evm.source_chain': evmConfig.chainId.toString(),
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
