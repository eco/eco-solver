import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { OpenTelemetryModule } from '@/modules/opentelemetry/opentelemetry.module';
import { QueueModule } from '@/modules/queue/queue.module';

import {
  RhinestoneActionProcessor,
  RhinestoneConfigService,
  RhinestoneWebsocketService,
} from './services';

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
 * - RelayerAction processing with ActionStatus responses
 * - Intent queueing to fulfillment system
 */
@Module({
  imports: [ConfigModule, OpenTelemetryModule, QueueModule],
  providers: [RhinestoneConfigService, RhinestoneWebsocketService, RhinestoneActionProcessor],
  exports: [RhinestoneConfigService, RhinestoneWebsocketService],
})
export class RhinestoneModule {}
