/**
 * Rhinestone-specific events
 */
export interface RhinestoneEvents {
  /**
   * Emitted when WebSocket connection is established
   */
  'rhinestone.connected': void;

  /**
   * Emitted when successfully authenticated with Rhinestone orchestrator
   */
  'rhinestone.authenticated': {
    connectionId: string;
  };

  /**
   * Emitted when WebSocket connection is closed
   */
  'rhinestone.disconnected': {
    code: number;
    reason: string;
  };

  /**
   * Emitted when WebSocket error occurs
   */
  'rhinestone.error': {
    error: Error;
    errorCode?: number;
    messageId?: string;
  };

  /**
   * Emitted when authentication fails
   */
  'rhinestone.auth.failed': {
    errorCode: number;
    message: string;
  };

  /**
   * Emitted when max reconnection attempts are reached
   */
  'rhinestone.reconnect.failed': void;
}
