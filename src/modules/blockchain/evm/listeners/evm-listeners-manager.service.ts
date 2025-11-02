import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { getErrorMessage } from '@/common/utils/error-handler';
import { ChainListener } from '@/modules/blockchain/evm/listeners/chain.listener';
import { BlockchainConfigService, EvmConfigService } from '@/modules/config/services';
import { QueueService } from '@/modules/queue/queue.service';
import { LeaderElectionService } from '@/modules/redis/leader-election.service';

import { EvmTransportService } from '../services/evm-transport.service';

@Injectable()
export class EvmListenersManagerService implements OnModuleInit, OnModuleDestroy {
  private listeners: Map<number, ChainListener> = new Map();
  private isListening = false;

  private readonly logger: PinoLogger;

  constructor(
    @InjectPinoLogger(EvmListenersManagerService.name)
    logger: PinoLogger,
    private evmConfigService: EvmConfigService,
    private transportService: EvmTransportService,
    private readonly blockchainConfigService: BlockchainConfigService,
    private readonly leaderElectionService: LeaderElectionService,
    private readonly queueService: QueueService,
  ) {
    this.logger = logger;
  }

  async onModuleInit(): Promise<void> {
    // Check if listeners are enabled
    if (!this.evmConfigService.listenersEnabled) {
      this.logger.info('EVM listeners are disabled via configuration');
      return;
    }

    // If leader election is enabled, wait for leadership
    if (this.leaderElectionService) {
      if (!this.leaderElectionService.isCurrentLeader()) {
        this.logger.info('EVM listeners waiting for leadership');
        return;
      }
    }

    await this.startListeners();
  }

  /**
   * Handle leadership gained event - start listeners
   */
  @OnEvent('leader.gained')
  async onLeadershipGained() {
    if (this.evmConfigService.listenersEnabled && !this.isListening) {
      this.logger.info('Leadership gained - starting EVM listeners');
      await this.startListeners();
    }
  }

  /**
   * Handle leadership lost event - stop listeners
   */
  @OnEvent('leader.lost')
  async onLeadershipLost() {
    if (this.isListening) {
      this.logger.info('Leadership lost - stopping EVM listeners');
      await this.stopListeners();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.stopListeners();
  }

  private async startListeners(): Promise<void> {
    if (this.isListening) {
      return; // Already listening
    }

    // Create and start a listener for each configured network
    for (const network of this.evmConfigService.networks) {
      const config: EvmChainConfig = {
        chainType: 'EVM',
        chainId: network.chainId,
        portalAddress: this.evmConfigService.getEvmPortalAddress(network.chainId),
      };

      // Create a new logger instance for each listener to avoid context pollution
      const listenerLogger = new Logger(`ChainListener:${network.chainId}`);

      try {
        const listener = new ChainListener(
          config,
          this.transportService,
          listenerLogger,
          this.blockchainConfigService,
          this.evmConfigService,
          this.queueService,
        );

        await listener.start();
        this.listeners.set(network.chainId, listener);

        this.logger.info(`Started EVM listener for chain ${network.chainId}`);
        this.isListening = true;
      } catch (error) {
        this.logger.error(
          `Unable to start listener for ${network.chainId}: ${getErrorMessage(error)}`,
        );
      }
    }
  }

  private async stopListeners(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    // Stop all listeners
    const stopPromises = Array.from(this.listeners.values()).map((listener) => listener.stop());
    await Promise.all(stopPromises);
    this.listeners.clear();
    this.isListening = false;
    this.logger.info('EVM listeners stopped');
  }
}
