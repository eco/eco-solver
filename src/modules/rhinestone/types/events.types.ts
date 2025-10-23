/**
 * Rhinestone event names for EventsService
 *
 * These events are emitted by RhinestoneWebsocketService and
 * can be listened to using @OnEvent decorator
 */
export const RHINESTONE_EVENTS = {
  /**
   * Emitted when WebSocket connection is established
   */
  CONNECTED: 'rhinestone.connected',

  /**
   * Emitted when successfully authenticated with Rhinestone orchestrator
   */
  AUTHENTICATED: 'rhinestone.authenticated',

  /**
   * Emitted when WebSocket connection is closed
   */
  DISCONNECTED: 'rhinestone.disconnected',

  /**
   * Emitted when WebSocket error occurs
   */
  ERROR: 'rhinestone.error',

  /**
   * Emitted when authentication fails
   */
  AUTH_FAILED: 'rhinestone.auth.failed',

  /**
   * Emitted when max reconnection attempts are reached
   */
  RECONNECT_FAILED: 'rhinestone.reconnect.failed',

  // Future events for intent processing:
  // RELAYER_ACTION: 'rhinestone.relayerAction',
  // ACTION_STATUS_ACK: 'rhinestone.actionStatus.ack',
} as const;

/**
 * Event payload types for Rhinestone events
 */
export interface RhinestoneEventPayloads {
  [RHINESTONE_EVENTS.CONNECTED]: void;
  [RHINESTONE_EVENTS.AUTHENTICATED]: {
    connectionId: string;
  };
  [RHINESTONE_EVENTS.DISCONNECTED]: {
    code: number;
    reason: string;
  };
  [RHINESTONE_EVENTS.ERROR]: {
    error: Error;
    errorCode?: number;
    messageId?: string;
  };
  [RHINESTONE_EVENTS.AUTH_FAILED]: {
    errorCode: number;
    message: string;
  };
  [RHINESTONE_EVENTS.RECONNECT_FAILED]: void;
}
