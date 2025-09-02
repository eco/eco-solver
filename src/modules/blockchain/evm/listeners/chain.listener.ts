import * as api from '@opentelemetry/api';
import { PublicClient } from 'viem';

import { PortalAbi } from '@/common/abis/portal.abi';
import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';
import { parseIntentFulfilled, parseIntentPublish } from '@/modules/blockchain/evm/utils/events';
import { BlockchainConfigService } from '@/modules/config/services';
import { EventsService } from '@/modules/events/events.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

export class ChainListener extends BaseChainListener {
  private unsubscribeIntentPublished: ReturnType<PublicClient['watchContractEvent']>;
  private unsubscribeIntentFulfilled: ReturnType<PublicClient['watchContractEvent']>;

  constructor(
    private readonly config: EvmChainConfig,
    private readonly transportService: EvmTransportService,
    private readonly eventsService: EventsService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    private readonly blockchainConfigService: BlockchainConfigService,
  ) {
    super();
    // Context is already set by the manager when creating the logger instance
  }

  async start(): Promise<void> {
    const evmConfig = this.config as EvmChainConfig;

    const publicClient = this.transportService.getPublicClient(evmConfig.chainId);

    const portalUniversalAddress = this.blockchainConfigService.getPortalAddress(evmConfig.chainId);
    if (!portalUniversalAddress) {
      throw new Error(`No Portal address configured for chain ${evmConfig.chainId}`);
    }
    const portalAddress = AddressNormalizer.denormalizeToEvm(portalUniversalAddress);

    this.logger.log(
      `Listening for IntentPublished and IntentFulfilled events, portal address: ${portalAddress}`,
    );

    // Watch for IntentPublished events
    this.unsubscribeIntentPublished = publicClient.watchContractEvent({
      abi: PortalAbi,
      eventName: 'IntentPublished',
      address: portalAddress,
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
            const intent = parseIntentPublish(BigInt(evmConfig.chainId), log);

            span.setAttributes({
              'evm.intent_id': intent.intentHash,
              'evm.source_chain': evmConfig.chainId.toString(),
              'evm.destination_chain': log.args.destination.toString(),
              'evm.creator': log.args.creator,
              'evm.prover': log.args.prover,
            });

            // Emit the event within the span context to propagate trace context
            api.context.with(api.trace.setSpan(api.context.active(), span), () => {
              this.eventsService.emit('intent.discovered', { intent, strategy: 'standard' });
            });

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

    // Watch for IntentFulfilled events
    this.unsubscribeIntentFulfilled = publicClient.watchContractEvent({
      abi: PortalAbi,
      eventName: 'IntentFulfilled',
      address: portalAddress,
      strict: true,
      onLogs: (logs) => {
        logs.forEach((log) => {
          const span = this.otelService.startSpan('evm.listener.processIntentFulfilledEvent', {
            attributes: {
              'evm.chain_id': this.config.chainId,
              'evm.event_name': 'IntentFulfilled',
              'portal.address': portalAddress,
              'evm.block_number': log.blockNumber?.toString(),
              'evm.transaction_hash': log.transactionHash,
            },
          });

          try {
            const event = parseIntentFulfilled(BigInt(evmConfig.chainId), log);

            span.setAttributes({
              'evm.intent_hash': event.intentHash,
              'evm.claimant': event.claimant,
            });

            // Emit the event within the span context to propagate trace context
            api.context.with(api.trace.setSpan(api.context.active(), span), () => {
              this.eventsService.emit('intent.fulfilled', event);
            });

            span.addEvent('intent.fulfilled.emitted');
            span.setStatus({ code: api.SpanStatusCode.OK });
          } catch (error) {
            this.logger.error(`Error processing IntentFulfilled event: ${error.message}`, error);
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
    if (this.unsubscribeIntentPublished) {
      this.unsubscribeIntentPublished();
      this.unsubscribeIntentPublished = null;
    }
    if (this.unsubscribeIntentFulfilled) {
      this.unsubscribeIntentFulfilled();
      this.unsubscribeIntentFulfilled = null;
    }
    this.logger.warn(`EVM listener stopped for chain ${this.config.chainId}`);
  }
}
