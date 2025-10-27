import { DynamicModule, Module } from '@nestjs/common';

import { configurationFactory } from '@/config/configuration-factory';
import { ConfigModule } from '@/modules/config/config.module';
import { OpenTelemetryModule } from '@/modules/opentelemetry/opentelemetry.module';

import { RhinestoneConfigService, RhinestoneWebsocketService } from './services';

/**
 * Rhinestone Module
 *
 * WebSocket client for Rhinestone orchestrator.
 * Handles authentication, message routing, and keepalive.
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
      imports: [ConfigModule, OpenTelemetryModule],
      providers: [RhinestoneConfigService, RhinestoneWebsocketService],
      exports: [RhinestoneConfigService, RhinestoneWebsocketService],
    };
  }
}
