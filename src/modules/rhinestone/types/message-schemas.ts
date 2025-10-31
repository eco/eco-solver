import { z } from 'zod';

import { RhinestoneErrorCode, RhinestoneMessageType } from '../enums';

/**
 * Hello message schema
 */
export const HelloMessageSchema = z.object({
  type: z.literal(RhinestoneMessageType.Hello),
  version: z.string().regex(/^v\d+\.\d+$/, 'Version must be in format v1.1'),
});

/**
 * Authentication message schema
 */
export const AuthenticationMessageSchema = z.object({
  type: z.literal(RhinestoneMessageType.Authentication),
  supportedVersion: z.string().regex(/^v\d+\.\d+$/),
  credentials: z.object({
    type: z.literal('ApiKey'),
    apiKey: z.string().min(10).max(100),
  }),
});

/**
 * Ok message schema for authentication response (wire format)
 * Note: 'context' field is added during parsing, not part of protocol
 */
export const OkAuthenticationMessageSchema = z
  .object({
    type: z.literal(RhinestoneMessageType.Ok),
    connectionId: z.string().min(1).max(200),
  })
  .transform((data) => ({ ...data, context: 'authentication' as const }));

/**
 * Ok message schema for action status acknowledgment (wire format)
 * Note: 'context' field is added during parsing, not part of protocol
 */
export const OkActionStatusMessageSchema = z
  .object({
    type: z.literal(RhinestoneMessageType.Ok),
    messageId: z.string().min(1).max(200),
  })
  .transform((data) => ({ ...data, context: 'action' as const }));

/**
 * Error message schema
 */
export const ErrorMessageSchema = z.object({
  type: z.literal(RhinestoneMessageType.Error),
  messageId: z.string().min(1).max(200).optional(),
  errorCode: z.nativeEnum(RhinestoneErrorCode),
  message: z.string().min(1).max(1000),
});

/**
 * Ok message wire schema (either auth or action variant)
 */
const OkMessageWireSchema = z.union([OkAuthenticationMessageSchema, OkActionStatusMessageSchema]);

/**
 * Union schema for all inbound messages
 */
export const RhinestoneInboundMessageSchema = z.union([
  HelloMessageSchema,
  OkMessageWireSchema,
  ErrorMessageSchema,
]);
