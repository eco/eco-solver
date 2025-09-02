import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { ChainListener } from '@/modules/blockchain/evm/listeners/chain.listener';
import { BlockchainConfigService, EvmConfigService } from '@/modules/config/services';
import { EventsService } from '@/modules/events/events.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { EvmTransportService } from '../services/evm-transport.service';

@Injectable()
export class EvmListenersManagerService implements OnModuleInit, OnModuleDestroy {
  private listeners: Map<number, ChainListener> = new Map();

  constructor(
    private evmConfigService: EvmConfigService,
    private transportService: EvmTransportService,
    private eventsService: EventsService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    private readonly blockchainConfigService: BlockchainConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly winstonLogger: Logger,
  ) {
    this.logger.setContext(EvmListenersManagerService.name);
  }

  async onModuleInit(): Promise<void> {
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

      const listener = new ChainListener(
        config,
        this.transportService,
        this.eventsService,
        listenerLogger,
        this.otelService,
        this.blockchainConfigService,
      );

      await listener.start();
      this.listeners.set(network.chainId, listener);
    }

    this.logger.log(
      `Started ${this.listeners.size} EVM listeners for chains: ${Array.from(
        this.listeners.keys(),
      ).join(', ')}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    // Stop all listeners
    const stopPromises = Array.from(this.listeners.values()).map((listener) => listener.stop());
    await Promise.all(stopPromises);
    this.listeners.clear();
  }
}
