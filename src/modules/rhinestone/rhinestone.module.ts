import { DynamicModule, Global, Module } from '@nestjs/common';

import { ConfigFactory } from '@/config/config-factory';
import { EvmCoreModule } from '@/modules/blockchain/evm/evm-core.module';
import { IntentsModule } from '@/modules/intents/intents.module';
import { OpenTelemetryModule } from '@/modules/opentelemetry/opentelemetry.module';
import { QueueModule } from '@/modules/queue/queue.module';
import { RedisModule } from '@/modules/redis/redis.module';

import {
  RhinestoneActionProcessor,
  RhinestoneContractsService,
  RhinestoneValidationService,
  RhinestoneWebsocketService,
} from './services';

/**
 * Rhinestone WebSocket client for orchestrator integration.
 * Global module - conditionally loaded if rhinestone config exists.
 */
@Global()
@Module({})
export class RhinestoneModule {
  static async forRootAsync(): Promise<DynamicModule> {
    const config = await ConfigFactory.loadConfig();

    // Only load if config exists (schema validates url/apiKey)
    if (!config.rhinestone) {
      return {
        global: true,
        module: RhinestoneModule,
        imports: [],
        providers: [],
        exports: [],
      };
    }

    return {
      global: true,
      module: RhinestoneModule,
      imports: [OpenTelemetryModule, QueueModule, IntentsModule, RedisModule, EvmCoreModule],
      providers: [
        RhinestoneContractsService,
        RhinestoneValidationService,
        RhinestoneWebsocketService,
        RhinestoneActionProcessor,
      ],
      exports: [
        RhinestoneContractsService,
        RhinestoneValidationService,
        RhinestoneWebsocketService,
      ],
    };
  }
}
