import { z } from 'zod';

/**
 * Successful ActionStatus response
 */
export interface ActionStatusSuccess {
  type: 'Success';
  preconfirmation: {
    txId: string;
  };
}

/**
 * Error reasons for ActionStatus
 */
export type ActionStatusErrorReason = 'Unprofitable' | 'PreconditionFailed' | 'WontFill';

/**
 * Chain-specific error details
 */
export interface ChainError {
  reason: string;
  message?: string;
  errorCode?: string;
  tokens?: string[];
}

/**
 * Error ActionStatus response
 */
export interface ActionStatusError {
  type: 'Error';
  reason: ActionStatusErrorReason;
  message?: string;
  chainErrors?: Record<string, ChainError>;
}

/**
 * Union of ActionStatus variants
 */
export type ActionStatus = ActionStatusSuccess | ActionStatusError;

/**
 * ActionStatus message sent to Rhinestone
 */
export interface ActionStatusMessage {
  type: 'ActionStatus';
  messageId: string;
  status: ActionStatus;
}

// Zod Schemas

/**
 * Success status schema
 */
const ActionStatusSuccessSchema = z.object({
  type: z.literal('Success'),
  preconfirmation: z.object({
    txId: z.string().min(1),
  }),
});

/**
 * Chain error schema
 */
const ChainErrorSchema = z.object({
  reason: z.string(),
  message: z.string().optional(),
  errorCode: z.string().optional(),
  tokens: z.array(z.string()).optional(),
});

/**
 * Error status schema
 */
const ActionStatusErrorSchema = z.object({
  type: z.literal('Error'),
  reason: z.enum(['Unprofitable', 'PreconditionFailed', 'WontFill']),
  message: z.string().optional(),
  chainErrors: z.record(ChainErrorSchema).optional(),
});

/**
 * Union schema for ActionStatus
 */
export const ActionStatusSchema = z.union([ActionStatusSuccessSchema, ActionStatusErrorSchema]);

/**
 * ActionStatus message schema
 */
export const ActionStatusMessageSchema = z.object({
  type: z.literal('ActionStatus'),
  messageId: z.string().min(1).max(200),
  status: ActionStatusSchema,
});
