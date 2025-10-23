import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { RhinestoneConfig } from '../interfaces/rhinestone-config.interface';

/**
 * Default configuration values for Rhinestone WebSocket
 * Note: URL and API key are required - no defaults provided
 */
const RHINESTONE_DEFAULTS = {
  RECONNECT: true,
  RECONNECT_INTERVAL_MS: 5000,
  MAX_RECONNECT_ATTEMPTS: 10,
  PING_INTERVAL_MS: 30000,
} as const;

/**
 * Configuration service for Rhinestone module
 *
 * Loads configuration from environment variables and provides
 * type-safe access to Rhinestone-specific settings.
 */
@Injectable()
export class RhinestoneConfigService {
  constructor(private readonly configService: NestConfigService) {}

  /**
   * Check if Rhinestone module is enabled
   * Reads from fulfillment.strategies.rhinestone.enabled configuration
   */
  get enabled(): boolean {
    return this.configService.get<boolean>('fulfillment.strategies.rhinestone.enabled', false);
  }

  /**
   * Get WebSocket configuration (includes API key for authentication)
   * Note: Only validates required fields if Rhinestone is enabled
   */
  get websocket(): RhinestoneConfig['websocket'] {
    const url = this.configService.get<string>('RHINESTONE_WS_URL', '');
    const apiKey = this.configService.get<string>('RHINESTONE_API_KEY', '');

    // Only enforce required fields if the module is enabled
    if (this.enabled) {
      if (!url) {
        throw new Error(
          'RHINESTONE_WS_URL is required but not set. Please set this environment variable.',
        );
      }

      if (!apiKey) {
        throw new Error(
          'RHINESTONE_API_KEY is required but not set. Please set this environment variable.',
        );
      }
    }

    return {
      url,
      apiKey,
      reconnect: this.configService.get<boolean>(
        'RHINESTONE_WS_RECONNECT',
        RHINESTONE_DEFAULTS.RECONNECT,
      ),
      reconnectInterval: this.configService.get<number>(
        'RHINESTONE_WS_RECONNECT_INTERVAL',
        RHINESTONE_DEFAULTS.RECONNECT_INTERVAL_MS,
      ),
      maxReconnectAttempts: this.configService.get<number>(
        'RHINESTONE_WS_MAX_RECONNECT_ATTEMPTS',
        RHINESTONE_DEFAULTS.MAX_RECONNECT_ATTEMPTS,
      ),
      pingInterval: this.configService.get<number>(
        'RHINESTONE_WS_PING_INTERVAL',
        RHINESTONE_DEFAULTS.PING_INTERVAL_MS,
      ),
    };
  }
}
