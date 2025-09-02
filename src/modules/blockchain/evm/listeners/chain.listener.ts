import * as api from '@opentelemetry/api';
import { PublicClient } from 'viem';

import { messageBridgeProverAbi } from '@/common/abis/message-bridge-prover.abi';
import { PortalAbi } from '@/common/abis/portal.abi';
import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { ChainType } from '@/common/utils/chain-type-detector';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';
import { parseIntentFulfilled, parseIntentPublish } from '@/modules/blockchain/evm/utils/events';
import { BlockchainConfigService, EvmConfigService } from '@/modules/config/services';
import { EventsService } from '@/modules/events/events.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

export class ChainListener extends BaseChainListener {
  private unsubscribeIntentPublished: ReturnType<PublicClient['watchContractEvent']> | null = null;
  private unsubscribeIntentFulfilled: ReturnType<PublicClient['watchContractEvent']> | null = null;
  private unsubscribeIntentWithdrawn: ReturnType<PublicClient['watchContractEvent']> | null = null;
  private proverUnsubscribers: Map<string, () => void> = new Map();

  constructor(
    private readonly config: EvmChainConfig,
    private readonly transportService: EvmTransportService,
    private readonly eventsService: EventsService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    private readonly blockchainConfigService: BlockchainConfigService,
    private readonly evmConfigService: EvmConfigService,
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
            // Add the transaction hash to the intent
            intent.publishTxHash = log.transactionHash;

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
            this.logger.error(`Error processing intent event: ${getErrorMessage(error)}`, toError(error));
            span.recordException(toError(error));
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
            const claimant = event.claimant as UniversalAddress;

            span.setAttributes({
              'evm.intent_hash': event.intentHash,
              'evm.claimant': claimant,
            });

            // Emit the event within the span context to propagate trace context
            api.context.with(api.trace.setSpan(api.context.active(), span), () => {
              this.eventsService.emit('intent.fulfilled', {
                intentHash: event.intentHash,
                claimant,
                txHash: log.transactionHash,
                blockNumber: log.blockNumber,
                timestamp: new Date(),
                chainId: BigInt(evmConfig.chainId),
              });
            });

            span.addEvent('intent.fulfilled.emitted');
            span.setStatus({ code: api.SpanStatusCode.OK });
          } catch (error) {
            this.logger.error(`Error processing IntentFulfilled event: ${getErrorMessage(error)}`, toError(error));
            span.recordException(toError(error));
            span.setStatus({ code: api.SpanStatusCode.ERROR });
          } finally {
            span.end();
          }
        });
      },
    });

    // Watch for IntentProven events from all configured prover contracts
    const network = this.evmConfigService.getChain(evmConfig.chainId);
    const provers = network.provers || {};

    for (const [proverType, proverAddress] of Object.entries(provers)) {
      if (!proverAddress) continue;

      const denormalizedProverAddress = AddressNormalizer.denormalizeToEvm(
        proverAddress as UniversalAddress,
      );

      this.logger.log(
        `Listening for IntentProven events from ${proverType} prover at address: ${denormalizedProverAddress}`,
      );

      const unsubscribe = publicClient.watchContractEvent({
        abi: messageBridgeProverAbi,
        eventName: 'IntentProven',
        address: denormalizedProverAddress,
        strict: true,
        onLogs: (logs) => {
          logs.forEach((log) => {
            const span = this.otelService.startSpan('evm.listener.processIntentProvenEvent', {
              attributes: {
                'evm.chain_id': this.config.chainId,
                'evm.event_name': 'IntentProven',
                'prover.type': proverType,
                'prover.address': denormalizedProverAddress,
                'evm.block_number': log.blockNumber?.toString(),
                'evm.transaction_hash': log.transactionHash,
              },
            });

            try {
              const intentHash = log.args.intentHash;
              const claimant = log.args.claimant as UniversalAddress;

              span.setAttributes({
                'evm.intent_hash': intentHash,
                'evm.claimant': claimant,
              });

              // Emit the event within the span context to propagate trace context
              api.context.with(api.trace.setSpan(api.context.active(), span), () => {
                this.eventsService.emit('intent.proven', {
                  intentHash,
                  claimant,
                  txHash: log.transactionHash,
                  blockNumber: log.blockNumber,
                  timestamp: new Date(),
                  chainId: BigInt(evmConfig.chainId),
                });
              });

              this.logger.log(
                `IntentProven event processed from ${proverType} prover: ${intentHash}`,
              );

              span.addEvent('intent.proven.emitted');
              span.setStatus({ code: api.SpanStatusCode.OK });
            } catch (error) {
              this.logger.error(
                `Error processing IntentProven event from ${proverType} prover: ${getErrorMessage(error)}`,
                toError(error),
              );
              span.recordException(error as Error);
              span.setStatus({ code: api.SpanStatusCode.ERROR });
            } finally {
              span.end();
            }
          });
        },
      });

      this.proverUnsubscribers.set(`${proverType}-${denormalizedProverAddress}`, unsubscribe);
    }

    // Watch for IntentWithdrawn events
    this.unsubscribeIntentWithdrawn = publicClient.watchContractEvent({
      abi: PortalAbi,
      eventName: 'IntentWithdrawn',
      address: portalAddress,
      strict: true,
      onLogs: (logs) => {
        logs.forEach((log) => {
          const span = this.otelService.startSpan('evm.listener.processIntentWithdrawnEvent', {
            attributes: {
              'evm.chain_id': this.config.chainId,
              'evm.event_name': 'IntentWithdrawn',
              'portal.address': portalAddress,
              'evm.block_number': log.blockNumber?.toString(),
              'evm.transaction_hash': log.transactionHash,
            },
          });

          try {
            const intentHash = log.args.intentHash;
            const claimant = AddressNormalizer.normalize(log.args.claimant, ChainType.EVM);

            span.setAttributes({
              'evm.intent_hash': intentHash,
              'evm.claimant': claimant,
            });

            // Emit the event within the span context to propagate trace context
            api.context.with(api.trace.setSpan(api.context.active(), span), () => {
              this.eventsService.emit('intent.withdrawn', {
                intentHash,
                claimant,
                txHash: log.transactionHash,
                blockNumber: log.blockNumber,
                timestamp: new Date(),
                chainId: BigInt(evmConfig.chainId),
              });
            });

            span.addEvent('intent.withdrawn.emitted');
            span.setStatus({ code: api.SpanStatusCode.OK });
          } catch (error) {
            this.logger.error(`Error processing IntentWithdrawn event: ${getErrorMessage(error)}`, toError(error));
            span.recordException(toError(error));
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
    // Cleanup all prover subscriptions
    for (const unsubscribe of this.proverUnsubscribers.values()) {
      unsubscribe();
    }
    this.proverUnsubscribers.clear();
    if (this.unsubscribeIntentWithdrawn) {
      this.unsubscribeIntentWithdrawn();
      this.unsubscribeIntentWithdrawn = null;
    }
    this.logger.warn(`EVM listener stopped for chain ${this.config.chainId}`);
  }
}
