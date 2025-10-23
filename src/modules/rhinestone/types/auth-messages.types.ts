import { RhinestoneErrorCode, RhinestoneMessageType } from '../enums';

/**
 * Hello message sent by server upon WebSocket connection
 *
 * Server sends this immediately after connection is established.
 * Client must respond with Authentication message within 2 seconds.
 */
export interface HelloMessage {
  type: RhinestoneMessageType.Hello;
  version: string;
}

/**
 * Authentication message sent by client
 *
 * Must be sent within 2 seconds of receiving Hello message.
 * Contains API key for authentication.
 */
export interface AuthenticationMessage {
  type: RhinestoneMessageType.Authentication;
  supportedVersion: string;
  credentials: {
    type: 'ApiKey';
    apiKey: string;
  };
}

/**
 * Ok message sent after successful authentication
 * Contains a unique connection identifier
 */
export interface OkAuthenticationMessage {
  type: RhinestoneMessageType.Ok;
  /**
   * Discriminant field to identify this as an authentication acknowledgment
   */
  context: 'authentication';
  /**
   * Unique identifier for this connection
   * Use this for troubleshooting with Rhinestone team
   */
  connectionId: string;
}

/**
 * Ok message sent to acknowledge ActionStatus submission (future feature)
 * Contains the messageId of the acknowledged message
 */
export interface OkActionStatusMessage {
  type: RhinestoneMessageType.Ok;
  /**
   * Discriminant field to identify this as an action status acknowledgment
   */
  context: 'action';
  /**
   * ID of the acknowledged ActionStatus message
   */
  messageId: string;
}

/**
 * Union type for all Ok message variants
 * Discriminated by the 'context' field for type-safe handling
 */
export type OkMessage = OkAuthenticationMessage | OkActionStatusMessage;

/**
 * Error message sent by server
 *
 * Can be sent during authentication flow or as reply to specific messages.
 * May result in connection drop depending on error code.
 */
export interface ErrorMessage {
  type: RhinestoneMessageType.Error;
  /**
   * Optional - present when error is in response to specific client message
   */
  messageId?: string;
  /**
   * Error code indicating type of error
   */
  errorCode: RhinestoneErrorCode;
  /**
   * Human-readable error description
   */
  message: string;
}

/**
 * Type guard to check if OkMessage is an authentication acknowledgment
 * Uses the 'context' discriminant field for type narrowing
 */
export function isOkAuthenticationMessage(message: OkMessage): message is OkAuthenticationMessage {
  return message.context === 'authentication';
}

/**
 * Type guard to check if OkMessage is an ActionStatus acknowledgment
 * Uses the 'context' discriminant field for type narrowing
 */
export function isOkActionStatusMessage(message: OkMessage): message is OkActionStatusMessage {
  return message.context === 'action';
}

/**
 * Union type of all authentication-related messages
 */
export type AuthMessage = HelloMessage | AuthenticationMessage | OkMessage | ErrorMessage;
