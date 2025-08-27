import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { BlockchainConfigService, TvmConfigService } from '@/modules/config/services';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { SystemLoggerService } from '@/modules/logging';
import { OpenTelemetryService } from '@/modules/opentelemetry';

import { TvmUtilsService } from '../services/tvm-utils.service';

import { TronListener } from './tron.listener';

@Injectable()
export class TvmListenersManagerService implements OnModuleInit, OnModuleDestroy {
  private listeners: TronListener[] = [];

  constructor(
    private readonly tvmConfigService: TvmConfigService,
    private readonly utilsService: TvmUtilsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly fulfillmentService: FulfillmentService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    private readonly blockchainConfigService: BlockchainConfigService,
  ) {
    this.logger.setContext(TvmListenersManagerService.name);
  }

  async onModuleInit() {
    await this.initializeListeners();
    this.setupEventHandlers();
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

      const listener = new TronListener(
        network,
        this.tvmConfigService.getTransactionSettings(),
        this.utilsService,
        this.eventEmitter,
        this.logger,
        this.otelService,
        this.blockchainConfigService,
      );

      this.listeners.push(listener);
      await listener.start();

      this.logger.log(`Started TVM listener for chain ${network.chainId}`);
    }

    this.logger.log(`Initialized ${this.listeners.length} TVM listeners`);
  }

  private setupEventHandlers() {
    // Listen for intent.discovered events and submit them to fulfillment
    this.eventEmitter.on('intent.discovered', async (event) => {
      const span = this.otelService.startSpan('tvm.listener.handleIntent', {
        attributes: {
          'tvm.intent_id': event.intent.intentHash,
          'tvm.source_chain': event.intent.sourceChainId.toString(),
          'tvm.destination_chain': event.intent.destination.toString(),
        },
      });

      try {
        await this.fulfillmentService.submitIntent(event.intent, event.strategy || 'standard');
        span.setStatus({ code: 0 }); // OK
      } catch (error) {
        this.logger.error(`Failed to submit intent to fulfillment:`, error);
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: error.message }); // ERROR
      } finally {
        span.end();
      }
    });
  }

  private async stopAllListeners() {
    await Promise.all(this.listeners.map((listener) => listener.stop()));
    this.listeners = [];
    this.logger.log('All TVM listeners stopped');
  }
}
