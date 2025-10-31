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
