/**
 * Rhinestone WebSocket error codes
 *
 * Based on Rhinestone Relayer Market v1.1 Protocol Definition
 * Non-exhaustive list - new codes can be added by Rhinestone
 */
export enum RhinestoneErrorCode {
  /**
   * Failed to parse client message
   */
  Serialization = 1,

  /**
   * Invalid API key provided during authentication
   */
  InvalidApiKey = 2,

  /**
   * API key is valid but has insufficient permissions
   */
  InsufficientPermissions = 3,

  /**
   * Client sent unexpected message for current context
   */
  UnexpectedClientMessage = 4,

  /**
   * Service encountered internal error
   */
  InternalError = 5,

  /**
   * Client failed to respond to ping within timeout
   */
  PingTimeout = 6,

  /**
   * Client failed to send ActionStatus response within timeout (3 seconds)
   */
  ResponseTimeout = 7,
}
