/**
 * Rhinestone configuration interface
 */
export interface RhinestoneConfig {
  /**
   * WebSocket configuration
   */
  websocket: {
    /**
     * WebSocket URL for Rhinestone orchestrator
     * @example 'wss://dev.v1.orchestrator.rhinestone.dev/ws/relayers'
     */
    url: string;

    /**
     * API key for WebSocket authentication
     * Required - sent in Authentication message after Hello
     */
    apiKey: string;

    /**
     * Enable automatic reconnection on disconnect
     * @default true
     */
    reconnect: boolean;

    /**
     * Time to wait between reconnection attempts (milliseconds)
     * @default 5000
     */
    reconnectInterval: number;

    /**
     * Maximum number of reconnection attempts before giving up
     * @default 10
     */
    maxReconnectAttempts: number;

    /**
     * Interval for sending ping messages to keep connection alive (milliseconds)
     * @default 30000
     */
    pingInterval: number;
  };
}
