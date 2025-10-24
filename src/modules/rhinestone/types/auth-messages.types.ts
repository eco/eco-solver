import { RhinestoneErrorCode, RhinestoneMessageType } from '../enums';

import { OkActionStatusMessageSchema, OkAuthenticationMessageSchema } from './message-schemas';

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
 * Ok message for successful authentication
 */
export interface OkAuthenticationMessage {
  type: RhinestoneMessageType.Ok;
  context: 'authentication';
  connectionId: string;
}

/**
 * Ok message acknowledging ActionStatus submission
 */
export interface OkActionStatusMessage {
  type: RhinestoneMessageType.Ok;
  context: 'action';
  messageId: string;
}

/**
 * Union of Ok message variants
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
 * Type guard for authentication Ok messages
 */
export function isOkAuthenticationMessage(message: OkMessage): message is OkAuthenticationMessage {
  return OkAuthenticationMessageSchema.safeParse(message).success;
}

/**
 * Type guard for action status Ok messages
 */
export function isOkActionStatusMessage(message: OkMessage): message is OkActionStatusMessage {
  return OkActionStatusMessageSchema.safeParse(message).success;
}

/**
 * Union type of all authentication-related messages
 */
export type AuthMessage = HelloMessage | AuthenticationMessage | OkMessage | ErrorMessage;

/**
 * Union type of all outbound messages sent by client
 */
export type OutboundMessage = AuthenticationMessage;
// Future: Add ActionStatusMessage when implementing Milestone 2
