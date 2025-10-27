import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import WebSocket from 'ws';

import { EventsService } from '@/modules/events/events.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { RhinestoneErrorCode, RhinestoneMessageType } from '../enums';
import {
  AuthenticationMessage,
  ErrorMessage,
  HelloMessage,
  isOkActionStatusMessage,
  isOkAuthenticationMessage,
  OkMessage,
  OutboundMessage,
} from '../types/auth-messages.types';
import { RHINESTONE_EVENTS } from '../types/events.types';
import { parseRhinestoneMessage } from '../types/message-schemas';

import { RhinestoneConfigService } from './rhinestone-config.service';

/**
 * Manages WebSocket connection to Rhinestone orchestrator
 *
 * Handles authentication, keepalive, reconnection, and event emission.
 * Credentials are redacted from logs for security.
 */
@Injectable()
export class RhinestoneWebsocketService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RhinestoneWebsocketService.name);
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private authenticationTimeout: NodeJS.Timeout | null = null;
  // This flag is used to prevent the service from reconnecting to the server if it is intentionally closed.
  private isIntentionallyClosed = false;
  private isAuthenticated = false;
  private connectionId: string | null = null;

  constructor(
    private readonly eventsService: EventsService,
    private readonly configService: RhinestoneConfigService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  /**
   * Initialize and connect to Rhinestone
   */
  async onModuleInit() {
    this.logger.log('RhinestoneWebsocketService initialized - connecting to Rhinestone');
    await this.connect();
  }

  /**
   * Cleanup on module destruction
   */
  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * Connect to Rhinestone WebSocket
   */
  async connect(): Promise<void> {
    return this.otelService.tracer.startActiveSpan(
      'rhinestone.websocket.connect',
      {
        attributes: {
          'rhinestone.ws.url': this.configService.websocket.url,
        },
      },
      async (span) => {
        try {
          // Check if connection already exists
          if (this.ws) {
            if (this.ws.readyState === WebSocket.OPEN) {
              this.logger.warn('WebSocket already connected - ignoring duplicate connect()');
              span.setAttribute('rhinestone.ws.already_connected', true);
              span.setStatus({ code: api.SpanStatusCode.OK });
              return;
            }

            if (this.ws.readyState === WebSocket.CONNECTING) {
              this.logger.warn(
                'WebSocket connection already in progress - ignoring duplicate connect()',
              );
              span.setAttribute('rhinestone.ws.already_connecting', true);
              span.setStatus({ code: api.SpanStatusCode.OK });
              return;
            }
          }

          const config = this.configService.websocket;

          // URL validation happens in config.websocket getter (throws if invalid)
          // This will catch non-wss:// URLs
          span.setAttribute('rhinestone.ws.url', config.url);
          span.setAttribute('rhinestone.ws.handshake_timeout_ms', config.handshakeTimeout);

          this.logger.log(`Connecting to WebSocket at ${config.url}`);
          span.addEvent('rhinestone.ws.connecting');

          // Only clear intentionallyClosed after validation passes
          this.isIntentionallyClosed = false;

          // Create WebSocket with handshake timeout option
          this.ws = new WebSocket(config.url, {
            handshakeTimeout: config.handshakeTimeout,
          });
          this.setupEventHandlers();

          span.addEvent('rhinestone.ws.handlers_setup');
          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (error) {
          this.logger.error(`Failed to create WebSocket connection: ${error}`);
          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Disconnect and cleanup resources
   */
  async disconnect(): Promise<void> {
    return this.otelService.tracer.startActiveSpan(
      'rhinestone.websocket.disconnect',
      {
        attributes: {
          'rhinestone.ws.connection_id': this.connectionId || 'none',
          'rhinestone.ws.was_authenticated': this.isAuthenticated,
        },
      },
      async (span) => {
        try {
          this.isIntentionallyClosed = true;
          this.isAuthenticated = false;
          this.connectionId = null;

          // Clear all timers
          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
          }

          if (this.authenticationTimeout) {
            clearTimeout(this.authenticationTimeout);
            this.authenticationTimeout = null;
          }

          this.stopPingInterval();

          if (this.ws) {
            // Remove all event listeners to prevent memory leaks
            this.ws.removeAllListeners();

            // Terminate socket in any non-CLOSED state
            if (this.ws.readyState !== WebSocket.CLOSED) {
              this.ws.close();
              this.logger.log('WebSocket connection closed');
              span.addEvent('rhinestone.ws.closed');
            }
            this.ws = null;
          }

          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (error) {
          this.logger.error(`Error during disconnect: ${error}`);
          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Check if connected and authenticated
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN && this.isAuthenticated;
  }

  /**
   * Get current connection ID
   */
  getConnectionId(): string | null {
    return this.connectionId;
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers() {
    if (!this.ws) return;

    const config = this.configService.websocket;

    this.ws.on('open', () => {
      this.logger.log('WebSocket connection established');
      this.reconnectAttempts = 0;

      // Set timeout for Hello message
      this.authenticationTimeout = setTimeout(() => {
        this.logger.error(`No Hello message received within ${config.helloTimeout}ms`);
        this.ws?.close();
      }, config.helloTimeout);

      this.eventsService.emit(RHINESTONE_EVENTS.CONNECTED, undefined);
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = this.parseMessage(data);
        this.logger.debug(`Received message type: ${message.type}`);

        // Route message based on type
        switch (message.type) {
          case RhinestoneMessageType.Hello:
            this.handleHello(message);
            break;

          case RhinestoneMessageType.Ok:
            this.handleOk(message);
            break;

          case RhinestoneMessageType.Error:
            this.handleError(message);
            break;
          default:
            if (!this.isAuthenticated) {
              this.logger.warn(
                `Received unknown message before authentication - ignoring: ${JSON.stringify(message)}`,
              );
              return;
            }
            this.logger.warn(`Unknown message - ignoring: ${JSON.stringify(message)}`);
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to parse message: ${error}`);
        this.eventsService.emit(RHINESTONE_EVENTS.ERROR, {
          error: error as Error,
        });
      }
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.logger.log(`WebSocket closed. Code: ${code}, Reason: ${reason.toString()}`);

      // Clear all pending timeouts before proceeding
      if (this.authenticationTimeout) {
        clearTimeout(this.authenticationTimeout);
        this.authenticationTimeout = null;
      }

      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      this.stopPingInterval();

      // Clear connection state
      this.isAuthenticated = false;
      this.connectionId = null;

      this.eventsService.emit(RHINESTONE_EVENTS.DISCONNECTED, {
        code,
        reason: reason.toString(),
      });

      // Attempt reconnect if not intentionally closed
      if (!this.isIntentionallyClosed) {
        const config = this.configService.websocket;
        if (config.reconnect) {
          this.attemptReconnect();
        }
      }
    });

    this.ws.on('error', (error: Error) => {
      this.logger.error(`WebSocket error: ${error.message}`);
      this.eventsService.emit(RHINESTONE_EVENTS.ERROR, {
        error,
      });
    });

    this.ws.on('ping', (_data: Buffer) => {
      this.logger.debug('Received ping from server');
      // ws library automatically sends pong - no action needed
    });

    this.ws.on('pong', (_data: Buffer) => {
      this.logger.debug('Received pong from server');
    });
  }

  /**
   * Parse and validate incoming WebSocket message
   */
  private parseMessage(data: WebSocket.Data) {
    return this.otelService.tracer.startActiveSpan(
      'rhinestone.websocket.parse_message',
      {},
      (span) => {
        try {
          let parsedData: unknown;

          // Handle all WebSocket.Data types
          if (data instanceof Buffer) {
            parsedData = JSON.parse(data.toString());
            span.setAttribute('rhinestone.ws.message_format', 'buffer');
          } else if (typeof data === 'string') {
            parsedData = JSON.parse(data);
            span.setAttribute('rhinestone.ws.message_format', 'string');
          } else if (data instanceof ArrayBuffer) {
            const buffer = Buffer.from(new Uint8Array(data));
            parsedData = JSON.parse(buffer.toString());
            span.setAttribute('rhinestone.ws.message_format', 'arraybuffer');
          } else if (Array.isArray(data)) {
            const concatenated = Buffer.concat(data);
            parsedData = JSON.parse(concatenated.toString());
            span.setAttribute('rhinestone.ws.message_format', 'buffer_array');
          } else {
            throw new Error('Unsupported message format');
          }

          // Validate message has type field
          if (typeof parsedData !== 'object' || parsedData === null || !('type' in parsedData)) {
            throw new Error('Message missing required "type" field');
          }

          const messageType = (parsedData as { type: unknown }).type;
          span.setAttribute('rhinestone.ws.message_type', String(messageType));

          // Validate message structure using discriminated union schema
          const result = parseRhinestoneMessage(parsedData);

          if (!result) {
            span.setAttribute('rhinestone.ws.unknown_type', true);
            throw new Error(`Invalid or unknown message type: ${messageType}`);
          }

          if (result.type === RhinestoneMessageType.Ok) {
            span.setAttribute('rhinestone.ws.ok_context', result.context);
          }

          span.setStatus({ code: api.SpanStatusCode.OK });
          return result;
        } catch (error) {
          this.logger.error(`Error parsing message: ${error}`);
          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Handle Hello message from server
   */
  private handleHello(message: HelloMessage) {
    this.logger.log(`Received Hello with version: ${message.version}`);

    // Clear the Hello timeout
    if (this.authenticationTimeout) {
      clearTimeout(this.authenticationTimeout);
      this.authenticationTimeout = null;
    }

    // Check version compatibility
    if (message.version !== 'v1.1') {
      this.logger.warn(
        `Server protocol version ${message.version} may not be compatible with v1.1`,
      );
    }

    // Send authentication - handle promise to avoid unhandled rejections
    this.sendAuthentication().catch((error) => {
      this.logger.error(`Error sending authentication: ${error}`);
      this.eventsService.emit(RHINESTONE_EVENTS.ERROR, {
        error: error as Error,
      });
      this.ws?.close();
    });
  }

  /**
   * Send Authentication message to server
   */
  private async sendAuthentication() {
    return this.otelService.tracer.startActiveSpan(
      'rhinestone.websocket.authenticate',
      {
        attributes: {
          'rhinestone.ws.protocol_version': 'v1.1',
        },
      },
      async (span) => {
        try {
          const config = this.configService.websocket;

          const authMessage: AuthenticationMessage = {
            type: RhinestoneMessageType.Authentication,
            supportedVersion: 'v1.1',
            credentials: {
              type: 'ApiKey',
              apiKey: config.apiKey,
            },
          };

          await this.send(authMessage);
          this.logger.log('Sent authentication message');

          span.addEvent('rhinestone.ws.auth_sent');

          // Set timeout for authentication response
          this.authenticationTimeout = setTimeout(() => {
            this.logger.error(`No authentication response within ${config.authTimeout}ms`);
            this.ws?.close();
          }, config.authTimeout);

          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (error) {
          this.logger.error(`Failed to send authentication: ${error}`);
          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          this.ws?.close();
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Handle Ok message from server
   */
  private handleOk(message: OkMessage) {
    return this.otelService.tracer.startActiveSpan(
      'rhinestone.websocket.handle_ok',
      {
        attributes: {
          'rhinestone.ws.message_type': message.type,
          'rhinestone.ws.message_context': message.context,
        },
      },
      (span) => {
        try {
          // Clear authentication timeout if present
          if (this.authenticationTimeout) {
            clearTimeout(this.authenticationTimeout);
            this.authenticationTimeout = null;
          }

          // Authentication success - discriminate using type guard
          if (isOkAuthenticationMessage(message)) {
            this.connectionId = message.connectionId;
            this.isAuthenticated = true;
            this.logger.log(`Authenticated successfully! Connection ID: ${message.connectionId}`);

            span.setAttribute('rhinestone.ws.connection_id', message.connectionId);
            span.setAttribute('rhinestone.ws.authenticated', true);
            span.addEvent('rhinestone.ws.authentication_success');

            // Start ping interval to keep connection alive
            this.startPingInterval();

            this.eventsService.emit(RHINESTONE_EVENTS.AUTHENTICATED, {
              connectionId: message.connectionId,
            });

            span.setStatus({ code: api.SpanStatusCode.OK });
            return;
          }

          // Future: ActionStatus acknowledgment handling
          if (isOkActionStatusMessage(message)) {
            this.logger.debug(`ActionStatus ${message.messageId} acknowledged by server`);
            span.setAttribute('rhinestone.ws.action_message_id', message.messageId);
            span.addEvent('rhinestone.ws.action_status_ack');
            // TODO: Emit event for ActionStatus acknowledgment
            span.setStatus({ code: api.SpanStatusCode.OK });
            return;
          }

          // If we reach here, the message structure is invalid
          this.logger.warn('Received Ok message with invalid structure', message);
          span.setAttribute('rhinestone.ws.invalid_structure', true);
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: 'Invalid message structure',
          });
        } catch (error) {
          this.logger.error(`Error handling Ok message: ${error}`);
          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Handle Error message from server
   */
  private handleError(message: ErrorMessage) {
    return this.otelService.tracer.startActiveSpan(
      'rhinestone.websocket.handle_error',
      {
        attributes: {
          'rhinestone.ws.error_code': message.errorCode,
          'rhinestone.ws.error_message': message.message,
          'rhinestone.ws.message_id': message.messageId || 'none',
        },
      },
      (span) => {
        try {
          this.logger.error(
            `Server error (code ${message.errorCode}): ${message.message}` +
              (message.messageId ? ` for message ${message.messageId}` : ''),
          );

          // Clear authentication timeout
          if (this.authenticationTimeout) {
            clearTimeout(this.authenticationTimeout);
            this.authenticationTimeout = null;
          }

          // Check if authentication failed
          if (
            message.errorCode === RhinestoneErrorCode.InvalidApiKey ||
            message.errorCode === RhinestoneErrorCode.InsufficientPermissions
          ) {
            this.logger.error('Authentication failed - will not reconnect');
            this.isIntentionallyClosed = true; // Don't try to reconnect

            span.setAttribute('rhinestone.ws.auth_failed', true);
            span.addEvent('rhinestone.ws.authentication_failed');

            this.eventsService.emit(RHINESTONE_EVENTS.AUTH_FAILED, {
              errorCode: message.errorCode,
              message: message.message,
            });

            this.ws?.close();
            span.setStatus({
              code: api.SpanStatusCode.ERROR,
              message: 'Authentication failed',
            });
            return;
          }

          // Other errors
          span.addEvent('rhinestone.ws.server_error');
          this.eventsService.emit(RHINESTONE_EVENTS.ERROR, {
            error: new Error(message.message),
            errorCode: message.errorCode,
            messageId: message.messageId,
          });

          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: message.message,
          });
        } catch (error) {
          this.logger.error(`Error handling Error message: ${error}`);
          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Send message through WebSocket
   */
  private async send(message: OutboundMessage): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const messageStr = JSON.stringify(message);

    return new Promise((resolve, reject) => {
      this.ws!.send(messageStr, (error) => {
        if (error) {
          this.logger.error(`Failed to send message: ${error}`);
          reject(error);
        } else {
          this.logger.debug(`Message sent: ${this.redactSensitiveData(messageStr)}`);
          resolve();
        }
      });
    });
  }

  /**
   * Redact sensitive data from logs
   */
  private redactSensitiveData(messageStr: string): string {
    try {
      const message = JSON.parse(messageStr);

      // Redact API key from Authentication messages
      if (message.type === RhinestoneMessageType.Authentication && message.credentials?.apiKey) {
        return JSON.stringify({
          ...message,
          credentials: {
            ...message.credentials,
            apiKey: this.maskApiKey(message.credentials.apiKey),
          },
        });
      }

      return messageStr;
    } catch {
      // If parsing fails, return original (it might already be a string)
      return messageStr;
    }
  }

  /**
   * Mask API key for logging
   */
  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 9) return '***';
    return `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}`;
  }

  /**
   * Start ping keepalive interval
   */
  private startPingInterval() {
    const config = this.configService.websocket;

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
        this.logger.debug('Sent ping to server');
      }
    }, config.pingInterval);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Attempt reconnection after disconnect
   */
  private attemptReconnect() {
    return this.otelService.tracer.startActiveSpan(
      'rhinestone.websocket.reconnect',
      {
        attributes: {
          'rhinestone.ws.reconnect_attempt': this.reconnectAttempts + 1,
          'rhinestone.ws.max_attempts': this.configService.websocket.maxReconnectAttempts,
        },
      },
      (span) => {
        try {
          const config = this.configService.websocket;

          if (this.reconnectAttempts >= config.maxReconnectAttempts) {
            this.logger.error('Max reconnect attempts reached');
            span.addEvent('rhinestone.ws.max_reconnect_reached');
            this.eventsService.emit(RHINESTONE_EVENTS.RECONNECT_FAILED, undefined);
            span.setStatus({
              code: api.SpanStatusCode.ERROR,
              message: 'Max reconnect attempts reached',
            });
            return;
          }

          this.reconnectAttempts++;

          this.logger.log(
            `Attempting to reconnect (${this.reconnectAttempts}/${config.maxReconnectAttempts}) in ${config.reconnectInterval}ms`,
          );

          span.addEvent('rhinestone.ws.reconnect_scheduled');
          span.setAttribute('rhinestone.ws.reconnect_delay_ms', config.reconnectInterval);

          this.reconnectTimeout = setTimeout(() => {
            this.connect().catch((error) => {
              this.logger.error(`Reconnect attempt failed: ${error}`);
            });
          }, config.reconnectInterval);

          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (error) {
          this.logger.error(`Error during reconnect attempt: ${error}`);
          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }
}
