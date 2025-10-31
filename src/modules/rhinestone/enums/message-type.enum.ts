/**
 * Rhinestone WebSocket message types
 *
 * Based on Rhinestone Relayer Market v1.1 Protocol Definition
 */
export enum RhinestoneMessageType {
  /**
   * Sent by server upon connection establishment
   */
  Hello = 'Hello',

  /**
   * Sent by client to authenticate with API key
   */
  Authentication = 'Authentication',

  /**
   * Sent by server to acknowledge successful operations
   */
  Ok = 'Ok',

  /**
   * Sent by server to indicate errors
   */
  Error = 'Error',

  // Future message types for intent processing:
  // RelayerAction = 'RelayerAction',
  // ActionStatus = 'ActionStatus',
}
