import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { z } from 'zod';

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
  HELLO_TIMEOUT_MS: 2000,
  AUTH_TIMEOUT_MS: 2000,
  HANDSHAKE_TIMEOUT_MS: 5000,
} as const;

/**
 * Zod schema for WebSocket URL validation
 * Must use secure WebSocket protocol (wss://)
 */
const WebSocketUrlSchema = z.string().url().startsWith('wss://', {
  message: 'WebSocket URL must use secure protocol (wss://)',
});

/**
 * Configuration service for Rhinestone module
 */
@Injectable()
export class RhinestoneConfigService {
  constructor(private readonly configService: NestConfigService) {}

  /**
   * Check if Rhinestone module is enabled
   */
  get enabled(): boolean {
    return this.configService.get<boolean>('fulfillment.strategies.rhinestone.enabled', false);
  }

  /**
   * Get WebSocket configuration
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

      // Validate URL format and security (must be wss://)
      const urlValidation = WebSocketUrlSchema.safeParse(url);
      if (!urlValidation.success) {
        throw new Error(
          `RHINESTONE_WS_URL is invalid: ${urlValidation.error.errors[0].message}. ` +
            'URL must be a valid wss:// (secure WebSocket) endpoint.',
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
      helloTimeout: this.configService.get<number>(
        'RHINESTONE_WS_HELLO_TIMEOUT',
        RHINESTONE_DEFAULTS.HELLO_TIMEOUT_MS,
      ),
      authTimeout: this.configService.get<number>(
        'RHINESTONE_WS_AUTH_TIMEOUT',
        RHINESTONE_DEFAULTS.AUTH_TIMEOUT_MS,
      ),
      handshakeTimeout: this.configService.get<number>(
        'RHINESTONE_WS_HANDSHAKE_TIMEOUT',
        RHINESTONE_DEFAULTS.HANDSHAKE_TIMEOUT_MS,
      ),
    };
  }
}
