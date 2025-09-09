import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

import { getErrorMessage } from '@/common/utils/error-handler';
import { TvmConfigService } from '@/modules/config/services';
import { EventsService } from '@/modules/events/events.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry';

import { TronListener } from './tron.listener';

@Injectable()
export class TvmListenersManagerService implements OnModuleInit, OnModuleDestroy {
  private listeners: TronListener[] = [];

  constructor(
    private readonly tvmConfigService: TvmConfigService,
    private readonly eventsService: EventsService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly winstonLogger: Logger,
  ) {
    this.logger.setContext(TvmListenersManagerService.name);
  }

  async onModuleInit() {
    await this.initializeListeners();
  }

  async onModuleDestroy() {
    await this.stopAllListeners();
  }

  private async initializeListeners() {
    const networks = this.tvmConfigService.networks;

    for (const network of networks) {
      if (!network.contracts.portal) {
        this.logger.warn(
          `Skipping TVM listener for chain ${network.chainId}: No portal address configured`,
        );
        continue;
      }

      // Create a new logger instance for each listener to avoid context pollution
      const listenerLogger = new SystemLoggerService(this.winstonLogger);
      listenerLogger.setContext(`TronListener:${network.chainId}`);

      try {
        const listener = new TronListener(
          network,
          this.tvmConfigService.getTransactionSettings(),
          this.eventsService,
          listenerLogger,
          this.otelService,
          this.tvmConfigService,
        );

        this.listeners.push(listener);
        await listener.start();

        this.logger.log(`Started TVM listener for chain ${network.chainId}`);
      } catch (error) {
        this.logger.error(
          `Unable to start listener for ${network.chainId}: ${getErrorMessage(error)}`,
        );
      }
    }

    this.logger.log(`Initialized ${this.listeners.length} TVM listeners`);
  }

  private async stopAllListeners() {
    await Promise.all(this.listeners.map((listener) => listener.stop()));
    this.listeners = [];
    this.logger.log('All TVM listeners stopped');
  }
}
