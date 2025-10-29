import { DynamicModule, Module } from '@nestjs/common';

import { configurationFactory } from '@/config/configuration-factory';
import { OpenTelemetryModule } from '@/modules/opentelemetry/opentelemetry.module';
import { QueueModule } from '@/modules/queue/queue.module';

import { RhinestoneActionProcessor, RhinestoneWebsocketService } from './services';

/**
 * Rhinestone Module
 *
 * WebSocket client for Rhinestone orchestrator.
 * Handles authentication, message routing, keepalive, and RelayerAction processing.
 *
 * Only loaded if rhinestone config exists with url and apiKey.
 */
@Module({})
export class RhinestoneModule {
  static async forRootAsync(): Promise<DynamicModule> {
    const config = await configurationFactory();

    // Only load if config exists (schema validates url/apiKey)
    if (!config.rhinestone) {
      return {
        module: RhinestoneModule,
        imports: [],
        providers: [],
        exports: [],
      };
    }

    return {
      module: RhinestoneModule,
      imports: [OpenTelemetryModule, QueueModule],
      providers: [RhinestoneWebsocketService, RhinestoneActionProcessor],
      exports: [RhinestoneWebsocketService],
    };
  }
}
