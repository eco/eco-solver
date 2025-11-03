import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { SolanaConfigService } from '@/modules/config/services';
import { EventsService } from '@/modules/events/events.service';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { Logger } from '@/modules/logging';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QueueService } from '@/modules/queue/queue.service';
import { LeaderElectionService } from '@/modules/redis/leader-election.service';

import { SolanaListener } from './solana.listener';

@Injectable()
export class SvmListenersManagerService implements OnModuleInit, OnModuleDestroy {
  private listeners: Map<number, SolanaListener> = new Map();
  private isListening = false;

  constructor(
    private readonly logger: Logger,
    private solanaConfigService: SolanaConfigService,
    private eventsService: EventsService,
    private fulfillmentService: FulfillmentService,
    private readonly otelService: OpenTelemetryService,
    private readonly leaderElectionService: LeaderElectionService,
    private readonly queueService: QueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Check if listeners are enabled
    if (!this.solanaConfigService.listenersEnabled) {
      this.logger.info('SVM listeners are disabled via configuration', {
        listenersEnabled: false,
      });
      return;
    }

    // If leader election is enabled, wait for leadership
    if (this.leaderElectionService) {
      if (!this.leaderElectionService.isCurrentLeader()) {
        this.logger.info('SVM listeners waiting for leadership', {
          isLeader: false,
        });
        return;
      }
    }

    await this.initializeListeners();
  }

  /**
   * Handle leadership gained event - start listeners
   */
  @OnEvent('leader.gained')
  async onLeadershipGained() {
    if (this.solanaConfigService.listenersEnabled && !this.isListening) {
      this.logger.info('Leadership gained - starting SVM listeners', {
        listenersEnabled: true,
        isListening: false,
      });
      await this.initializeListeners();
    }
  }

  /**
   * Handle leadership lost event - stop listeners
   */
  @OnEvent('leader.lost')
  async onLeadershipLost() {
    if (this.isListening) {
      this.logger.info('Leadership lost - stopping SVM listeners', {
        isListening: true,
      });
      await this.stopAllListeners();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.stopAllListeners();
  }

  private async initializeListeners(): Promise<void> {
    if (this.isListening) {
      return; // Already listening
    }

    // Check if Solana configuration exists
    if (!this.solanaConfigService.secretKey) {
      this.logger.info('Solana configuration not found, skipping SVM listeners', {
        hasSecretKey: false,
      });
      return;
    }

    const chainId = this.solanaConfigService.chainId;

    try {
      const listener = new SolanaListener(this.logger, this.solanaConfigService, this.queueService);

      await listener.start();
      this.listeners.set(chainId, listener);

      this.logger.info('Started SVM listener for chain', {
        chainId: Number(chainId),
        chainType: 'svm',
        isListening: true,
      });
      this.isListening = true;
    } catch (error) {
      this.logger.error('Unable to start listener', error, {
        chainId: Number(chainId),
        chainType: 'svm',
      });
    }
  }

  private async stopAllListeners(): Promise<void> {
    if (!this.isListening || this.listeners.size === 0) {
      return;
    }

    await Promise.all(Array.from(this.listeners.values()).map((listener) => listener.stop()));
    const chainIds = Array.from(this.listeners.keys());
    this.listeners.clear();
    this.isListening = false;
    this.logger.info('Stopped all SVM listeners', {
      chainType: 'svm',
      isListening: false,
      listenersCount: 0,
      chainIds,
    });
  }
}
