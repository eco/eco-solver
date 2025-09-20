import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { getErrorMessage } from '@/common/utils/error-handler';
import { ChainListener } from '@/modules/blockchain/evm/listeners/chain.listener';
import { BlockchainConfigService, EvmConfigService } from '@/modules/config/services';
import { EventsService } from '@/modules/events/events.service';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QueueService } from '@/modules/queue/queue.service';
import { LeaderElectionService } from '@/modules/redis/leader-election.service';

import { EvmTransportService } from '../services/evm-transport.service';

@Injectable()
export class EvmListenersManagerService implements OnModuleInit, OnModuleDestroy {
  private listeners: Map<number, ChainListener> = new Map();
  private isListening = false;

  constructor(
    private evmConfigService: EvmConfigService,
    private transportService: EvmTransportService,
    private eventsService: EventsService,
    private fulfillmentService: FulfillmentService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    private readonly blockchainConfigService: BlockchainConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly winstonLogger: Logger,
    private readonly leaderElectionService: LeaderElectionService,
    private readonly queueService: QueueService,
  ) {
    this.logger.setContext(EvmListenersManagerService.name);
  }

  async onModuleInit(): Promise<void> {
    // Check if listeners are enabled
    if (!this.evmConfigService.listenersEnabled) {
      this.logger.log('EVM listeners are disabled via configuration');
      return;
    }

    // If leader election is enabled, wait for leadership
    if (this.leaderElectionService) {
      if (!this.leaderElectionService.isCurrentLeader()) {
        this.logger.log('EVM listeners waiting for leadership');
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
      this.logger.log('Leadership gained - starting EVM listeners');
      await this.startListeners();
    }
  }

  /**
   * Handle leadership lost event - stop listeners
   */
  @OnEvent('leader.lost')
  async onLeadershipLost() {
    if (this.isListening) {
      this.logger.log('Leadership lost - stopping EVM listeners');
      await this.stopListeners();
    }
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
      const listenerLogger = new SystemLoggerService(this.winstonLogger);
      listenerLogger.setContext(`ChainListener:${network.chainId}`);

      try {
        const listener = new ChainListener(
          config,
          this.transportService,
          this.eventsService,
          this.fulfillmentService,
          listenerLogger,
          this.otelService,
          this.blockchainConfigService,
          this.evmConfigService,
          this.queueService,
        );

        await listener.start();
        this.listeners.set(network.chainId, listener);

        this.logger.log(`Started EVM listener for chain ${network.chainId}`);
        this.isListening = true;
      } catch (error) {
        this.logger.error(
          `Unable to start listener for ${network.chainId}: ${getErrorMessage(error)}`,
        );
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.stopListeners();
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
    this.logger.log('EVM listeners stopped');
  }
}
