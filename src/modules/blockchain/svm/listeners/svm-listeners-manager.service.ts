import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

import { getErrorMessage } from '@/common/utils/error-handler';
import {
  BlockchainConfigService,
  FulfillmentConfigService,
  SolanaConfigService,
} from '@/modules/config/services';
import { EventsService } from '@/modules/events/events.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { SolanaListener } from './solana.listener';

@Injectable()
export class SvmListenersManagerService implements OnModuleInit, OnModuleDestroy {
  private listeners: Map<number, SolanaListener> = new Map();

  constructor(
    private solanaConfigService: SolanaConfigService,
    private eventsService: EventsService,
    private fulfillmentConfigService: FulfillmentConfigService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    private readonly blockchainConfigService: BlockchainConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly winstonLogger: Logger,
  ) {
    this.logger.setContext(SvmListenersManagerService.name);
  }

  async onModuleInit(): Promise<void> {
    await this.initializeListeners();
  }

  async onModuleDestroy(): Promise<void> {
    await this.stopAllListeners();
  }

  private async initializeListeners(): Promise<void> {
    // Check if Solana configuration exists
    if (!this.solanaConfigService.secretKey) {
      this.logger.log('Solana configuration not found, skipping SVM listeners');
      return;
    }

    const chainId = this.solanaConfigService.chainId;

    // Create a new logger instance for the listener to avoid context pollution
    const listenerLogger = new SystemLoggerService(this.winstonLogger);
    listenerLogger.setContext(`SolanaListener:${chainId}`);

    try {
      const listener = new SolanaListener(
        this.solanaConfigService,
        this.eventsService,
        this.fulfillmentConfigService,
        listenerLogger,
        this.blockchainConfigService,
      );

      await listener.start();
      this.listeners.set(chainId, listener);

      this.logger.log(`Started SVM listener for chain ${chainId}`);
    } catch (error) {
      this.logger.error(`Unable to start listener for ${chainId}: ${getErrorMessage(error)}`);
    }
  }

  private async stopAllListeners(): Promise<void> {
    if (this.listeners.size === 0) {
      return;
    }

    await Promise.all(Array.from(this.listeners.values()).map((listener) => listener.stop()));
    this.listeners.clear();
    this.logger.log('Stopped all SVM listeners');
  }
}
