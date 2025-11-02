import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { getErrorMessage } from '@/common/utils/error-handler';
import { TvmConfigService } from '@/modules/config/services';
import { OpenTelemetryService } from '@/modules/opentelemetry';
import { QueueService } from '@/modules/queue/queue.service';
import { LeaderElectionService } from '@/modules/redis/leader-election.service';

import { TronListener } from './tron.listener';

@Injectable()
export class TvmListenersManagerService implements OnModuleInit, OnModuleDestroy {
  private listeners: TronListener[] = [];
  private isListening = false;
  private readonly logger: PinoLogger;

  constructor(
    @InjectPinoLogger(TvmListenersManagerService.name)
    logger: PinoLogger,
    private readonly tvmConfigService: TvmConfigService,
    private readonly otelService: OpenTelemetryService,
    private readonly leaderElectionService: LeaderElectionService,
    private readonly queueService: QueueService,
  ) {
    this.logger = logger;
  }

  async onModuleInit(): Promise<void> {
    // Check if listeners are enabled
    if (!this.tvmConfigService.listenersEnabled) {
      this.logger.info('TVM listeners are disabled via configuration');
      return;
    }

    // If leader election is enabled, wait for leadership
    if (this.leaderElectionService) {
      if (!this.leaderElectionService.isCurrentLeader()) {
        this.logger.info('TVM listeners waiting for leadership');
        return;
      }
    }

    await this.initializeListeners();
  }

  async onModuleDestroy() {
    await this.stopAllListeners();
  }

  @OnEvent('leader.gained')
  async onLeadershipGained() {
    if (this.tvmConfigService.listenersEnabled && !this.isListening) {
      this.logger.info('Leadership gained - starting TVM listeners');
      await this.initializeListeners();
    }
  }

  @OnEvent('leader.lost')
  async onLeadershipLost() {
    if (this.isListening) {
      this.logger.info('Leadership lost - stopping TVM listeners');
      await this.stopAllListeners();
    }
  }

  private async initializeListeners() {
    // Check if listeners are enabled
    if (!this.tvmConfigService.listenersEnabled) {
      this.logger.info('TVM listeners are disabled via configuration');
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
      const listenerLogger = new Logger(`TronListener:${network.chainId}`);

      try {
        const listener = new TronListener(
          network,
          this.tvmConfigService.getTransactionSettings(),
          listenerLogger,
          this.otelService,
          this.tvmConfigService,
          this.queueService,
        );

        this.listeners.push(listener);
        await listener.start();

        this.logger.info(`Started TVM listener for chain ${network.chainId}`);
      } catch (error) {
        this.logger.error(
          `Unable to start listener for ${network.chainId}: ${getErrorMessage(error)}`,
        );
      }
    }

    if (this.listeners.length > 0) {
      this.isListening = true;
    }
    this.logger.info(`Initialized ${this.listeners.length} TVM listeners`);
  }

  private async stopAllListeners() {
    if (!this.isListening) {
      return;
    }

    await Promise.all(this.listeners.map((listener) => listener.stop()));
    this.listeners = [];
    this.isListening = false;
    this.logger.info('All TVM listeners stopped');
  }
}
