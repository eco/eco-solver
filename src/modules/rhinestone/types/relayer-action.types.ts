import { z } from 'zod';

import { RhinestoneMessageType } from '../enums';

/**
 * Chain call details for execution
 */
export interface ChainCall {
  chainId: number;
  to: string;
  data: string;
  value: string;
}

/**
 * Fill action to execute on destination chain
 */
export interface FillAction {
  id: number;
  call: ChainCall;
  eip7702Delegation?: unknown | null;
}

/**
 * Claim action for rewards (before or after fill)
 */
export interface ClaimAction {
  id: number;
  call: ChainCall;
  eip7702Delegation?: unknown | null;
  beforeFill: boolean;
}

/**
 * RelayerAction payload (version 1)
 */
export interface RelayerActionV1 {
  id: string;
  timestamp: number;
  fill: FillAction;
  claims: ClaimAction[];
  metadata?: Record<string, unknown>;
}

/**
 * RelayerAction envelope with messageId
 */
export interface RelayerActionEnvelope {
  type: RhinestoneMessageType.RelayerAction;
  messageId: string;
  action: RelayerActionV1;
}

// Zod Schemas

/**
 * Chain call schema
 */
export const ChainCallSchema = z.object({
  chainId: z.number().int().positive(),
  to: z.string().min(1),
  data: z.string(),
  value: z.string(),
});

/**
 * Fill action schema
 */
export const FillActionSchema = z.object({
  id: z.number().int(),
  call: ChainCallSchema,
  eip7702Delegation: z.unknown().nullable(),
});

/**
 * Claim action schema
 */
export const ClaimActionSchema = z.object({
  id: z.number().int(),
  call: ChainCallSchema,
  eip7702Delegation: z.unknown().nullable(),
  beforeFill: z.boolean(),
});

/**
 * RelayerAction V1 schema
 */
export const RelayerActionV1Schema = z.object({
  id: z.string().min(1),
  timestamp: z.number().int().positive(),
  fill: FillActionSchema,
  claims: z.array(ClaimActionSchema),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * RelayerAction envelope schema
 */
export const RelayerActionEnvelopeSchema = z.object({
  type: z.literal(RhinestoneMessageType.RelayerAction),
  messageId: z.string().min(1).max(200),
  action: RelayerActionV1Schema,
});

/**
 * Parse and validate RelayerAction message
 */
export function parseRelayerAction(data: unknown): RelayerActionEnvelope {
  return RelayerActionEnvelopeSchema.parse(data);
}
