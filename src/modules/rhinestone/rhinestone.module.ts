import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { OpenTelemetryModule } from '@/modules/opentelemetry/opentelemetry.module';

import { RhinestoneConfigService, RhinestoneWebsocketService } from './services';

/**
 * Rhinestone Module
 *
 * Handles WebSocket connection to Rhinestone orchestrator for receiving
 * cross-chain intent fulfillment requests via RelayerAction messages.
 *
 * Features:
 * - WebSocket connection management with automatic reconnection
 * - Authentication flow with API key
 * - Ping/pong keepalive mechanism
 * - Event-based message handling
 *
 * Future: ActionStatus responses and intent processing
 */
@Module({
  imports: [ConfigModule, OpenTelemetryModule],
  providers: [
    RhinestoneConfigService,
    RhinestoneWebsocketService,
    // TODO: Add RhinestoneActionProcessor for intent processing
  ],
  exports: [RhinestoneConfigService, RhinestoneWebsocketService],
})
export class RhinestoneModule {}
