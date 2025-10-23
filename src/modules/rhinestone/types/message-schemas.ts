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
 * Ok message schema for authentication response
 */
export const OkAuthenticationMessageSchema = z.object({
  type: z.literal(RhinestoneMessageType.Ok),
  context: z.literal('authentication'),
  connectionId: z.string().min(1).max(200),
});

/**
 * Ok message schema for action status acknowledgment
 */
export const OkActionStatusMessageSchema = z.object({
  type: z.literal(RhinestoneMessageType.Ok),
  context: z.literal('action'),
  messageId: z.string().min(1).max(200),
});

/**
 * Error message schema
 */
export const ErrorMessageSchema = z.object({
  type: z.literal(RhinestoneMessageType.Error),
  messageId: z.string().min(1).max(200).optional(),
  errorCode: z.nativeEnum(RhinestoneErrorCode),
  message: z.string().min(1).max(1000),
});

export function parseHelloMessage(data: unknown) {
  return HelloMessageSchema.parse(data);
}

export function parseAuthenticationMessage(data: unknown) {
  return AuthenticationMessageSchema.parse(data);
}

/**
 * Parse Ok message and infer context discriminant
 */
export function parseOkMessage(data: unknown) {
  const authResult = OkAuthenticationMessageSchema.safeParse(data);
  if (authResult.success) {
    return { ...authResult.data, context: 'authentication' as const };
  }

  const actionResult = OkActionStatusMessageSchema.safeParse(data);
  if (actionResult.success) {
    return { ...actionResult.data, context: 'action' as const };
  }

  throw new Error(
    `Ok message validation failed: ${authResult.error.message} AND ${actionResult.error.message}`,
  );
}

export function parseErrorMessage(data: unknown) {
  return ErrorMessageSchema.parse(data);
}
