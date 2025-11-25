import { isAddress } from 'viem';
import { z } from 'zod';

import { RhinestoneMessageType } from '../enums';
import { isValidBigInt, isValidEthereumAddress, isValidHexData } from '../utils/validation';

/**
 * Chain call details for execution
 */
export interface ChainCall {
  chainId: number;
  to: string;
  data: `0x${string}`;
  value: string;
}

/**
 * Token transfer details
 */
export interface TokenTransfer {
  tokenAddress: string;
  amount: string;
}

/**
 * Fill action to execute on destination chain
 */
export interface FillAction {
  call: ChainCall;
  metadata: {
    settlementLayers: string[];
    tokensOut: TokenTransfer[];
  };
}

/**
 * Claim action for rewards (before or after fill)
 */
export interface ClaimAction {
  call: ChainCall;
  beforeFill: boolean;
  metadata: {
    tokensIn: TokenTransfer[];
    settlementLayer: string;
  };
}

/**
 * RelayerAction payload (version 1)
 */
export interface RelayerActionV1 {
  type: 'RelayerActionV1';
  id: string;
  timestamp: number;
  fill: FillAction;
  claims: ClaimAction[];
  metadata?: {
    dryRun?: boolean;
    userAddress?: string;
  };
}

/**
 * RelayerAction envelope with messageId
 */
export interface RelayerActionEnvelope {
  type: RhinestoneMessageType.RelayerAction;
  messageId: string;
  action: RelayerActionV1;
  maxExecutionTime?: number; // Optional execution time limit in ms
}

// Zod Schemas

/**
 * Chain call schema
 */
export const ChainCallSchema = z.object({
  chainId: z.number().int().positive(),
  to: z.string().refine((val) => isAddress(val), {
    message: 'Invalid Ethereum address (must be valid checksum)',
  }),
  data: z
    .string()
    .refine((val) => isValidHexData(val), {
      message:
        'Invalid hex data (must start with 0x and contain only hex characters with even length)',
    })
    .transform((val) => val as `0x${string}`),
  value: z.string().refine((val) => isValidBigInt(val), {
    message: 'Invalid value (must be a non-negative integer as decimal or 0x-prefixed hex string)',
  }),
});

/**
 * Token transfer schema
 */
const TokenTransferSchema = z.object({
  tokenAddress: z.string().refine((val) => isValidEthereumAddress(val), {
    message: 'Invalid Ethereum address',
  }),
  amount: z.string().refine((val) => isValidBigInt(val), {
    message: 'Invalid value (must be a non-negative integer as decimal or 0x-prefixed hex string)',
  }),
});

/**
 * Fill action schema
 */
export const FillActionSchema = z.object({
  call: ChainCallSchema,
  metadata: z.object({
    settlementLayers: z.array(z.string()),
    tokensOut: z.array(TokenTransferSchema),
  }),
});

/**
 * Claim action schema
 */
export const ClaimActionSchema = z.object({
  call: ChainCallSchema,
  beforeFill: z.boolean(),
  metadata: z.object({
    tokensIn: z.array(TokenTransferSchema),
    settlementLayer: z.string(),
  }),
});

/**
 * RelayerAction V1 schema
 */
export const RelayerActionV1Schema = z.object({
  type: z.literal('RelayerActionV1'),
  id: z.string().min(1),
  timestamp: z.number().int().positive(),
  fill: FillActionSchema,
  claims: z.array(ClaimActionSchema),
  metadata: z
    .object({
      dryRun: z.boolean().optional(),
      userAddress: z
        .string()
        .refine((val) => isValidEthereumAddress(val), {
          message: 'Invalid Ethereum address',
        })
        .optional(),
    })
    .optional(),
});

/**
 * RelayerAction envelope schema
 */
export const RelayerActionEnvelopeSchema = z.object({
  type: z.literal(RhinestoneMessageType.RelayerAction),
  messageId: z.string().min(1).max(200),
  action: RelayerActionV1Schema,
  maxExecutionTime: z.number().int().positive().optional(), // Optional execution time limit in ms
});
