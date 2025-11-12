import { z } from 'zod';

import type { ActionStatusMessage } from './action-status.types';
import {
  AuthenticationMessageSchema,
  ErrorMessageSchema,
  HelloMessageSchema,
  OkActionStatusMessageSchema,
  OkAuthenticationMessageSchema,
} from './message-schemas';

/**
 * Hello message sent by server upon WebSocket connection
 *
 * Server sends this immediately after connection is established.
 * Client must respond with Authentication message within 2 seconds.
 */
export type HelloMessage = z.infer<typeof HelloMessageSchema>;

/**
 * Authentication message sent by client
 *
 * Must be sent within 2 seconds of receiving Hello message.
 * Contains API key for authentication.
 */
export type AuthenticationMessage = z.infer<typeof AuthenticationMessageSchema>;
/**
 * Ok message for successful authentication
 */
export type OkAuthenticationMessage = z.infer<typeof OkAuthenticationMessageSchema>;

/**
 * Ok message acknowledging ActionStatus submission
 */
export type OkActionStatusMessage = z.infer<typeof OkActionStatusMessageSchema>;

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
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;

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
export type OutboundMessage = AuthenticationMessage | ActionStatusMessage;
