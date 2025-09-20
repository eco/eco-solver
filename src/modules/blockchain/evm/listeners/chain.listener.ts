import * as api from '@opentelemetry/api';
import { Address, type Log, PublicClient } from 'viem';

import { messageBridgeProverAbi } from '@/common/abis/message-bridge-prover.abi';
import { portalAbi } from '@/common/abis/portal.abi';
import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { Intent } from '@/common/interfaces/intent.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';
import { EvmEventParser } from '@/modules/blockchain/evm/utils/evm-event-parser';
import { BlockchainConfigService, EvmConfigService } from '@/modules/config/services';
import { EventsService } from '@/modules/events/events.service';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

// Event name constants
const EVENT_NAMES = {
  INTENT_PUBLISHED: 'IntentPublished',
  INTENT_FULFILLED: 'IntentFulfilled',
  INTENT_WITHDRAWN: 'IntentWithdrawn',
  INTENT_PROVEN: 'IntentProven',
} as const;

export class ChainListener extends BaseChainListener {
  // Single Map to store all subscription unsubscribe functions
  private subscriptions: Array<() => void> = [];

  constructor(
    private readonly config: EvmChainConfig,
    private readonly transportService: EvmTransportService,
    private readonly eventsService: EventsService,
    private readonly fulfillmentService: FulfillmentService,
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

    const portalUniversalAddress = this.blockchainConfigService.getPortalAddress(evmConfig.chainId);
    if (!portalUniversalAddress) {
      throw new Error(`No Portal address configured for chain ${evmConfig.chainId}`);
    }
    const portalAddress = AddressNormalizer.denormalizeToEvm(portalUniversalAddress);

    const publicClient = this.transportService.getPublicClient(evmConfig.chainId);
    await this.setupListeners(publicClient, evmConfig, portalAddress);

    this.logger.log(
      `Listening for IntentPublished and IntentFulfilled events, portal address: ${portalAddress}`,
    );

    // Set up polling transport listeners if available
    const hasPolling = this.transportService.hasPollingTransport(evmConfig.chainId);
    if (hasPolling) {
      const pollingClient = this.transportService.getPollingPublicClient(evmConfig.chainId);
      if (pollingClient) {
        const chainConfig = this.evmConfigService.getChain(evmConfig.chainId);
        const httpConfig = this.evmConfigService.getHttpConfigForWebSocket(chainConfig);

        await this.setupListeners(
          pollingClient,
          evmConfig,
          portalAddress,
          httpConfig?.pollingInterval,
        );

        this.logger.log(`Listen for events using polling as backup`);
      }
    }
  }

  async stop(): Promise<void> {
    // Clear all subscriptions
    this.clearAllSubscriptions();
    this.logger.warn(`EVM listener stopped for chain ${this.config.chainId}`);
  }

  /**
   * Clears all subscriptions
   */
  private clearAllSubscriptions(): void {
    for (const unsubscribe of this.subscriptions) {
      unsubscribe();
    }
  }

  private async setupListeners(
    publicClient: PublicClient,
    evmConfig: EvmChainConfig,
    portalAddress: Address,
    pollingInterval?: number,
  ): Promise<void> {
    // Configure polling interval if provided
    const watchOptions = {
      abi: portalAbi,
      address: portalAddress,
      strict: true,
      ...(pollingInterval ? { pollingInterval } : {}),
    } as const;

    // Watch for IntentPublished events
    const unsubscribeIntentPublished = publicClient.watchContractEvent({
      ...watchOptions,
      eventName: 'IntentPublished' as const,
      onLogs: async (logs) => {
        for (const log of logs) {
          await this.handleIntentPublishedEvent(log, evmConfig, portalAddress);
        }
      },
    });

    // Store unsubscribe function
    this.subscriptions.push(unsubscribeIntentPublished);

    // Watch for IntentFulfilled events
    const unsubscribeIntentFulfilled = publicClient.watchContractEvent({
      ...watchOptions,
      eventName: 'IntentFulfilled' as const,
      onLogs: (logs) => {
        logs.forEach((log) => {
          this.handleIntentFulfilledEvent(log, evmConfig, portalAddress);
        });
      },
    });

    // Store unsubscribe function
    this.subscriptions.push(unsubscribeIntentFulfilled);

    // Watch for IntentProven events from all configured prover contracts
    const network = this.evmConfigService.getChain(evmConfig.chainId);
    const provers = network.provers;

    for (const [proverType, proverAddress] of Object.entries(provers)) {
      if (!proverAddress) continue;

      this.logger.log(
        `Listening for IntentProven events from ${proverType} prover at address: ${proverAddress}`,
      );

      const proverWatchOptions = pollingInterval ? { pollingInterval } : {};

      const unsubscribe = publicClient.watchContractEvent({
        ...proverWatchOptions,
        abi: messageBridgeProverAbi,
        address: proverAddress,
        eventName: 'IntentProven',
        onLogs: (logs) => {
          logs.forEach((log) => {
            this.handleIntentProvenEvent(log, evmConfig, proverType, proverAddress);
          });
        },
        strict: true,
      });

      this.subscriptions.push(unsubscribe);
    }

    // Watch for IntentWithdrawn events
    const unsubscribeIntentWithdrawn = publicClient.watchContractEvent({
      ...watchOptions,
      eventName: 'IntentWithdrawn' as const,
      onLogs: (logs) => {
        logs.forEach((log) => {
          this.handleIntentWithdrawnEvent(log, evmConfig, portalAddress);
        });
      },
    });

    // Store unsubscribe function
    this.subscriptions.push(unsubscribeIntentWithdrawn);
  }

  /**
   * Handles IntentPublished event
   */
  private async handleIntentPublishedEvent(
    log: Log,
    evmConfig: EvmChainConfig,
    portalAddress: string,
  ): Promise<void> {
    // Start the first trace using startActiveSpan (listener stage)
    await this.otelService.tracer.startActiveSpan(
      'evm.listener.processIntentEvent',
      {
        attributes: {
          'trace.correlation.id': log.transactionHash || 'unknown',
          'trace.stage': 'listener',
          'evm.chain_id': evmConfig.chainId,
          'evm.event_name': EVENT_NAMES.INTENT_PUBLISHED,
          'portal.address': portalAddress,
          'evm.block_number': log.blockNumber ? log.blockNumber.toString() : undefined,
          'evm.transaction_hash': log.transactionHash ? log.transactionHash : undefined,
        },
      },
      async (span) => {
        let intent: Intent;
        try {
          intent = EvmEventParser.parseIntentPublish(BigInt(evmConfig.chainId), log);
          // Add the transaction hash to the intent
          intent.publishTxHash = log.transactionHash || undefined;

          span.setAttributes({
            'evm.intent_hash': intent.intentHash,
            'evm.source_chain': evmConfig.chainId.toString(),
            'evm.destination_chain': intent.destination.toString(),
            'evm.creator': intent.reward.creator,
            'evm.prover': intent.reward.prover,
          });
        } catch (error) {
          this.logger.error(
            `Error processing intent event: ${getErrorMessage(error)}`,
            toError(error),
          );
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          span.end();
          return;
        }

        try {
          await this.fulfillmentService.submitIntent(intent);
          this.logger.log(`Intent ${intent.intentHash} submitted to fulfillment queue`);
          span.addEvent('intent.submitted');
          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (error) {
          this.logger.error(`Failed to submit intent ${intent.intentHash}:`, toError(error));
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Handles IntentFulfilled event
   */
  private handleIntentFulfilledEvent(
    log: Log<bigint, number, false>,
    evmConfig: EvmChainConfig,
    portalAddress: string,
  ): void {
    return this.otelService.tracer.startActiveSpan(
      'evm.listener.processIntentFulfilledEvent',
      {
        attributes: {
          'evm.chain_id': evmConfig.chainId,
          'evm.event_name': EVENT_NAMES.INTENT_FULFILLED,
          'portal.address': portalAddress,
          'evm.block_number': log.blockNumber?.toString(),
          'evm.transaction_hash': log.transactionHash,
        },
      },
      (span) => {
        try {
          const event = EvmEventParser.parseIntentFulfilled(BigInt(evmConfig.chainId), log);

          span.setAttributes({
            'evm.intent_hash': event.intentHash,
            'evm.claimant': event.claimant,
          });

          this.eventsService.emit('intent.fulfilled', event);

          span.addEvent('intent.fulfilled.emitted');
          span.setStatus({ code: api.SpanStatusCode.OK });
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
      },
    );
  }

  /**
   * Handles IntentWithdrawn event
   */
  private handleIntentWithdrawnEvent(
    log: Log<bigint, number, false>,
    evmConfig: EvmChainConfig,
    portalAddress: string,
  ): void {
    return this.otelService.tracer.startActiveSpan(
      'evm.listener.processIntentWithdrawnEvent',
      {
        attributes: {
          'evm.chain_id': evmConfig.chainId,
          'evm.event_name': EVENT_NAMES.INTENT_WITHDRAWN,
          'portal.address': portalAddress,
          'evm.block_number': log.blockNumber ? log.blockNumber.toString() : undefined,
          'evm.transaction_hash': log.transactionHash ? log.transactionHash : undefined,
        },
      },
      (span) => {
        try {
          const event = EvmEventParser.parseIntentWithdrawn(evmConfig.chainId, log);

          span.setAttributes({
            'evm.intent_hash': event.intentHash,
            'evm.claimant': event.claimant,
          });

          this.eventsService.emit('intent.withdrawn', event);

          span.addEvent('intent.withdrawn.emitted');
          span.setStatus({ code: api.SpanStatusCode.OK });
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
      },
    );
  }

  /**
   * Handles IntentProven event
   */
  private handleIntentProvenEvent(
    log: Log<bigint, number, false>,
    evmConfig: EvmChainConfig,
    proverType: string,
    proverAddress: string,
  ): void {
    return this.otelService.tracer.startActiveSpan(
      'evm.listener.processIntentProvenEvent',
      {
        attributes: {
          'evm.chain_id': evmConfig.chainId,
          'evm.event_name': EVENT_NAMES.INTENT_PROVEN,
          'prover.type': proverType,
          'prover.address': proverAddress,
          'evm.block_number': log.blockNumber?.toString(),
          'evm.transaction_hash': log.transactionHash || undefined,
        },
      },
      (span) => {
        try {
          const event = EvmEventParser.parseIntentProven(evmConfig.chainId, log);
          const { intentHash, claimant } = event;

          span.setAttributes({
            'evm.intent_hash': intentHash,
            'evm.claimant': claimant,
          });

          this.eventsService.emit('intent.proven', event);

          this.logger.log(`IntentProven event processed from ${proverType} prover: ${intentHash}`);

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
      },
    );
  }
}
