import { DynamicModule, Global, Module } from '@nestjs/common';

import { configurationFactory } from '@/config/configuration-factory';
import { EvmCoreModule } from '@/modules/blockchain/evm/evm-core.module';
import { OpenTelemetryModule } from '@/modules/opentelemetry/opentelemetry.module';
import { ProverModule } from '@/modules/prover/prover.module';
import { QueueModule } from '@/modules/queue/queue.module';

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
    const config = await configurationFactory();

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
      imports: [OpenTelemetryModule, QueueModule, EvmCoreModule, ProverModule],
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
