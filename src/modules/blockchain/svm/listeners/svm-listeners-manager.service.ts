import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { getErrorMessage } from '@/common/utils/error-handler';
import { SolanaConfigService } from '@/modules/config/services';
import { EventsService } from '@/modules/events/events.service';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QueueService } from '@/modules/queue/queue.service';
import { LeaderElectionService } from '@/modules/redis/leader-election.service';

import { SolanaListener } from './solana.listener';

@Injectable()
export class SvmListenersManagerService implements OnModuleInit, OnModuleDestroy {
  private listeners: Map<number, SolanaListener> = new Map();
  private isListening = false;

  constructor(
    @InjectPinoLogger(SvmListenersManagerService.name)
    private readonly logger: PinoLogger,
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
      this.logger.info('SVM listeners are disabled via configuration');
      return;
    }

    // If leader election is enabled, wait for leadership
    if (this.leaderElectionService) {
      if (!this.leaderElectionService.isCurrentLeader()) {
        this.logger.info('SVM listeners waiting for leadership');
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
      this.logger.info('Leadership gained - starting SVM listeners');
      await this.initializeListeners();
    }
  }

  /**
   * Handle leadership lost event - stop listeners
   */
  @OnEvent('leader.lost')
  async onLeadershipLost() {
    if (this.isListening) {
      this.logger.info('Leadership lost - stopping SVM listeners');
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
      this.logger.info('Solana configuration not found, skipping SVM listeners');
      return;
    }

    const chainId = this.solanaConfigService.chainId;

    try {
      const listener = new SolanaListener(this.logger, this.solanaConfigService, this.queueService);

      await listener.start();
      this.listeners.set(chainId, listener);

      this.logger.info(`Started SVM listener for chain ${chainId}`);
      this.isListening = true;
    } catch (error) {
      this.logger.error(`Unable to start listener for ${chainId}: ${getErrorMessage(error)}`);
    }
  }

  private async stopAllListeners(): Promise<void> {
    if (!this.isListening || this.listeners.size === 0) {
      return;
    }

    await Promise.all(Array.from(this.listeners.values()).map((listener) => listener.stop()));
    this.listeners.clear();
    this.isListening = false;
    this.logger.info('Stopped all SVM listeners');
  }
}
