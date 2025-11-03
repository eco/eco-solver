import { Address, type Log, PublicClient } from 'viem';

import { messageBridgeProverAbi } from '@/common/abis/message-bridge-prover.abi';
import { portalAbi } from '@/common/abis/portal.abi';
import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { toError } from '@/common/utils/error-handler';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';
import { BlockchainEventJob } from '@/modules/blockchain/interfaces/blockchain-event-job.interface';
import { BlockchainConfigService, EvmConfigService } from '@/modules/config/services';
import { Logger } from '@/modules/logging';
import { QueueService } from '@/modules/queue/queue.service';

export class ChainListener extends BaseChainListener {
  // Single Map to store all subscription unsubscribe functions
  private subscriptions: Array<() => void> = [];

  constructor(
    private readonly config: EvmChainConfig,
    private readonly transportService: EvmTransportService,
    private readonly logger: Logger,
    private readonly blockchainConfigService: BlockchainConfigService,
    private readonly evmConfigService: EvmConfigService,
    private readonly queueService: QueueService,
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

    this.logger.info('Listening for IntentPublished and IntentFulfilled events', {
      chainId: evmConfig.chainId,
      portalAddress,
    });

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

        this.logger.info('EVM Listeners for events using polling as backup', {
          chainId: evmConfig.chainId,
          portalAddress,
          pollingInterval: httpConfig?.pollingInterval,
        });
      }
    }
  }

  async stop(): Promise<void> {
    // Clear all subscriptions
    this.clearAllSubscriptions();
    this.logger.warn('EVM listener stopped', {
      chainId: this.config.chainId,
      chainType: 'evm',
    });
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
      onError: (error) => {
        this.logger.error('Error in IntentPublished watcher', toError(error), {
          chainId: evmConfig.chainId,
          chainType: 'evm',
          contractName: 'portal',
          portalAddress,
          eventType: 'IntentPublished',
        });
      },
    });

    // Store unsubscribe function
    this.subscriptions.push(unsubscribeIntentPublished);

    // Watch for IntentFulfilled events
    const unsubscribeIntentFulfilled = publicClient.watchContractEvent({
      ...watchOptions,
      eventName: 'IntentFulfilled' as const,
      onLogs: async (logs) => {
        for (const log of logs) {
          await this.handleIntentFulfilledEvent(log, evmConfig, portalAddress);
        }
      },
      onError: (error) => {
        this.logger.error('Error in IntentFulfilled watcher', toError(error), {
          chainId: evmConfig.chainId,
          chainType: 'evm',
          contractName: 'portal',
          portalAddress,
          eventType: 'IntentFulfilled',
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

      this.logger.info('Listening for IntentProven events', {
        chainId: evmConfig.chainId,
        chainType: 'evm',
        contractName: 'prover',
        proverType,
        proverAddress,
        eventType: 'IntentProven',
      });

      const proverWatchOptions = pollingInterval ? { pollingInterval } : {};

      const unsubscribe = publicClient.watchContractEvent({
        ...proverWatchOptions,
        abi: messageBridgeProverAbi,
        address: proverAddress,
        eventName: 'IntentProven',
        onLogs: async (logs) => {
          for (const log of logs) {
            await this.handleIntentProvenEvent(log, evmConfig, proverType, proverAddress);
          }
        },
        onError: (error) => {
          this.logger.error('Error in IntentProven watcher', toError(error), {
            chainId: evmConfig.chainId,
            chainType: 'evm',
            contractName: 'prover',
            proverType,
            proverAddress,
            eventType: 'IntentProven',
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
      onLogs: async (logs) => {
        for (const log of logs) {
          await this.handleIntentWithdrawnEvent(log, evmConfig, portalAddress);
        }
      },
      onError: (error) => {
        this.logger.error('Error in IntentWithdrawn watcher', toError(error), {
          chainId: evmConfig.chainId,
          chainType: 'evm',
          contractName: 'portal',
          portalAddress,
          eventType: 'IntentWithdrawn',
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
    log: Log<bigint, number, false, undefined, true, typeof portalAbi, 'IntentPublished'>,
    evmConfig: EvmChainConfig,
    portalAddress: string,
  ): Promise<void> {
    try {
      // Queue the event for processing
      const eventJob: BlockchainEventJob = {
        eventType: 'IntentPublished',
        chainId: evmConfig.chainId,
        chainType: 'evm',
        contractName: 'portal',
        intentHash: log.args.intentHash,
        eventData: log,
        metadata: {
          txHash: log.transactionHash || undefined,
          blockNumber: log.blockNumber || undefined,
          logIndex: log.logIndex || undefined,
          contractAddress: portalAddress,
        },
      };

      await this.queueService.addBlockchainEvent(eventJob);
      this.logger.debug('Queued IntentPublished event', {
        intentHash: log.args.intentHash,
        chainId: evmConfig.chainId,
        chainType: 'evm',
        contractName: 'portal',
        eventType: 'IntentPublished',
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      });
    } catch (error) {
      this.logger.error('Failed to queue IntentPublished event', toError(error), {
        intentHash: log.args.intentHash,
        chainId: evmConfig.chainId,
        chainType: 'evm',
        contractName: 'portal',
        eventType: 'IntentPublished',
      });
    }
  }

  /**
   * Handles IntentFulfilled event
   */
  private async handleIntentFulfilledEvent(
    log: Log<bigint, number, false, undefined, true, typeof portalAbi, 'IntentFulfilled'>,
    evmConfig: EvmChainConfig,
    portalAddress: string,
  ): Promise<void> {
    try {
      // Queue the event for processing
      const eventJob: BlockchainEventJob = {
        eventType: 'IntentFulfilled',
        chainId: evmConfig.chainId,
        chainType: 'evm',
        contractName: 'portal',
        intentHash: log.args.intentHash,
        eventData: log,
        metadata: {
          txHash: log.transactionHash || undefined,
          blockNumber: log.blockNumber || undefined,
          logIndex: log.logIndex || undefined,
          contractAddress: portalAddress,
        },
      };

      await this.queueService.addBlockchainEvent(eventJob);
      this.logger.debug('Queued IntentFulfilled event', {
        intentHash: log.args.intentHash,
        chainId: evmConfig.chainId,
        chainType: 'evm',
        contractName: 'portal',
        eventType: 'IntentFulfilled',
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      });
    } catch (error) {
      this.logger.error('Failed to queue IntentFulfilled event', toError(error), {
        intentHash: log.args.intentHash,
        chainId: evmConfig.chainId,
        chainType: 'evm',
        contractName: 'portal',
        eventType: 'IntentFulfilled',
      });
    }
  }

  /**
   * Handles IntentWithdrawn event
   */
  private async handleIntentWithdrawnEvent(
    log: Log<bigint, number, false, undefined, true, typeof portalAbi, 'IntentWithdrawn'>,
    evmConfig: EvmChainConfig,
    portalAddress: string,
  ): Promise<void> {
    try {
      // Queue the event for processing
      const eventJob: BlockchainEventJob = {
        eventType: 'IntentWithdrawn',
        chainId: evmConfig.chainId,
        chainType: 'evm',
        contractName: 'portal',
        intentHash: log.args.intentHash,
        eventData: log,
        metadata: {
          txHash: log.transactionHash || undefined,
          blockNumber: log.blockNumber || undefined,
          logIndex: log.logIndex || undefined,
          contractAddress: portalAddress,
        },
      };

      await this.queueService.addBlockchainEvent(eventJob);
      this.logger.debug('Queued IntentWithdrawn event', {
        intentHash: log.args.intentHash,
        chainId: evmConfig.chainId,
        chainType: 'evm',
        contractName: 'portal',
        eventType: 'IntentWithdrawn',
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      });
    } catch (error) {
      this.logger.error('Failed to queue IntentWithdrawn event', toError(error), {
        intentHash: log.args.intentHash,
        chainId: evmConfig.chainId,
        chainType: 'evm',
        contractName: 'portal',
        eventType: 'IntentWithdrawn',
      });
    }
  }

  /**
   * Handles IntentProven event
   */
  private async handleIntentProvenEvent(
    log: Log<bigint, number, false, undefined, true, typeof messageBridgeProverAbi, 'IntentProven'>,
    evmConfig: EvmChainConfig,
    proverType: string,
    proverAddress: string,
  ): Promise<void> {
    try {
      // Queue the event for processing
      const eventJob: BlockchainEventJob = {
        eventType: 'IntentProven',
        chainId: evmConfig.chainId,
        chainType: 'evm',
        contractName: 'prover',
        intentHash: log.args.intentHash,
        eventData: log,
        metadata: {
          txHash: log.transactionHash || undefined,
          blockNumber: log.blockNumber || undefined,
          logIndex: log.logIndex || undefined,
          contractAddress: proverAddress,
          proverType,
        },
      };

      await this.queueService.addBlockchainEvent(eventJob);
      this.logger.debug('Queued IntentProven event', {
        intentHash: log.args.intentHash,
        chainId: evmConfig.chainId,
        chainType: 'evm',
        contractName: 'prover',
        proverType,
        eventType: 'IntentProven',
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      });
    } catch (error) {
      this.logger.error('Failed to queue IntentProven event', toError(error), {
        intentHash: log.args.intentHash,
        chainId: evmConfig.chainId,
        chainType: 'evm',
        contractName: 'prover',
        proverType,
        eventType: 'IntentProven',
      });
    }
  }
}
