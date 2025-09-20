import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

import { getErrorMessage } from '@/common/utils/error-handler';
import { TvmConfigService } from '@/modules/config/services';
import { EventsService } from '@/modules/events/events.service';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry';
import { QueueService } from '@/modules/queue/queue.service';
import { LeaderElectionService } from '@/modules/redis/leader-election.service';

import { TronListener } from './tron.listener';

@Injectable()
export class TvmListenersManagerService implements OnModuleInit, OnModuleDestroy {
  private listeners: TronListener[] = [];
  private isListening = false;

  constructor(
    private readonly tvmConfigService: TvmConfigService,
    private readonly eventsService: EventsService,
    private readonly fulfillmentService: FulfillmentService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly winstonLogger: Logger,
    private readonly leaderElectionService: LeaderElectionService,
    private readonly queueService: QueueService,
  ) {
    this.logger.setContext(TvmListenersManagerService.name);
  }

  async onModuleInit() {
    // Don't start listeners on init - wait for leader election
  }

  async onModuleDestroy() {
    await this.stopAllListeners();
  }

  @OnEvent('leader.gained')
  async onLeadershipGained() {
    if (this.tvmConfigService.listenersEnabled && !this.isListening) {
      this.logger.log('Leadership gained - starting TVM listeners');
      await this.initializeListeners();
    }
  }

  @OnEvent('leader.lost')
  async onLeadershipLost() {
    if (this.isListening) {
      this.logger.log('Leadership lost - stopping TVM listeners');
      await this.stopAllListeners();
    }
  }

  private async initializeListeners() {
    // Check if listeners are enabled
    if (!this.tvmConfigService.listenersEnabled) {
      this.logger.log('TVM listeners are disabled via configuration');
      return;
    }

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
          this.fulfillmentService,
          listenerLogger,
          this.otelService,
          this.tvmConfigService,
          this.queueService,
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

    if (this.listeners.length > 0) {
      this.isListening = true;
    }
    this.logger.log(`Initialized ${this.listeners.length} TVM listeners`);
  }

  private async stopAllListeners() {
    if (!this.isListening) {
      return;
    }

    await Promise.all(this.listeners.map((listener) => listener.stop()));
    this.listeners = [];
    this.isListening = false;
    this.logger.log('All TVM listeners stopped');
  }
}
