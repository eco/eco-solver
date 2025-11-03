import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { TvmConfigService } from '@/modules/config/services';
import { Logger, LoggerFactory } from '@/modules/logging';
import { OpenTelemetryService } from '@/modules/opentelemetry';
import { QueueService } from '@/modules/queue/queue.service';
import { LeaderElectionService } from '@/modules/redis/leader-election.service';

import { TronListener } from './tron.listener';

@Injectable()
export class TvmListenersManagerService implements OnModuleInit, OnModuleDestroy {
  private listeners: TronListener[] = [];
  private isListening = false;

  constructor(
    private readonly logger: Logger,
    private readonly loggerFactory: LoggerFactory,
    private readonly tvmConfigService: TvmConfigService,
    private readonly otelService: OpenTelemetryService,
    private readonly leaderElectionService: LeaderElectionService,
    private readonly queueService: QueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Check if listeners are enabled
    if (!this.tvmConfigService.listenersEnabled) {
      this.logger.info('TVM listeners disabled via configuration', {
        chainType: 'tvm',
        listenersEnabled: false,
      });
      return;
    }

    // If leader election is enabled, wait for leadership
    if (this.leaderElectionService) {
      if (!this.leaderElectionService.isCurrentLeader()) {
        this.logger.info('TVM listeners waiting for leadership', {
          chainType: 'tvm',
          isLeader: false,
        });
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
      this.logger.info('Leadership gained, starting TVM listeners', {
        chainType: 'tvm',
        listenersEnabled: true,
        isListening: false,
      });
      await this.initializeListeners();
    }
  }

  @OnEvent('leader.lost')
  async onLeadershipLost() {
    if (this.isListening) {
      this.logger.info('Leadership lost, stopping TVM listeners', {
        chainType: 'tvm',
        isListening: true,
      });
      await this.stopAllListeners();
    }
  }

  private async initializeListeners() {
    // Check if listeners are enabled
    if (!this.tvmConfigService.listenersEnabled) {
      this.logger.info('TVM listeners disabled via configuration', {
        chainType: 'tvm',
        listenersEnabled: false,
      });
      return;
    }

    const networks = this.tvmConfigService.networks;

    for (const network of networks) {
      if (!network.contracts.portal) {
        this.logger.warn('Skipping TVM listener, no portal address configured', {
          chainId: network.chainId.toString(),
          chainType: 'tvm',
          portalAddress: network.contracts.portal,
        });
        continue;
      }

      // Create a new logger instance for each listener to avoid context pollution
      const listenerLogger = this.loggerFactory.createLogger(`TronListener:${network.chainId}`);

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

        this.logger.info('Started TVM listener', {
          chainId: network.chainId.toString(),
          chainType: 'tvm',
          portalAddress: network.contracts.portal,
        });
      } catch (error) {
        this.logger.error('Unable to start TVM listener', error, {
          chainId: network.chainId.toString(),
          chainType: 'tvm',
          portalAddress: network.contracts.portal,
        });
      }
    }

    if (this.listeners.length > 0) {
      this.isListening = true;
    }
    this.logger.info('Initialized TVM listeners', {
      chainType: 'tvm',
      listenerCount: this.listeners.length,
    });
  }

  private async stopAllListeners() {
    if (!this.isListening) {
      return;
    }

    const listenerCount = this.listeners.length;
    await Promise.all(this.listeners.map((listener) => listener.stop()));
    this.listeners = [];
    this.isListening = false;
    this.logger.info('Stopped all TVM listeners', {
      chainType: 'tvm',
      stoppedCount: listenerCount,
    });
  }
}
