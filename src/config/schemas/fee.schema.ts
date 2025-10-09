import { z } from 'zod';

/**
 * fee logic configuration schema
 */
const FeeSchema = z.object({
  flatFee: z.coerce.number().min(0), // Using string for bigint compatibility (in wei)
  scalarBps: z.coerce.number().min(0).max(10000), // Basis points (0-10000 = 0-100%)
});

export const AssetsFeeSchema = z.object({
  tokens: FeeSchema,
  nonSwapTokens: FeeSchema,
  native: FeeSchema.optional(),
});

export type AssetsFeeSchemaType = z.infer<typeof AssetsFeeSchema>;
export type FeeSchemaType = z.infer<typeof FeeSchema>;

/**
 * Route-level override schema (exact srcChain+srcToken -> dstChain+dstToken)
 */
export const RouteFeeOverrideSchema = z.object({
  sourceChainId: z.coerce.string(),
  destinationChainId: z.coerce.string(),
  sourceToken: z.string(),
  destinationToken: z.string(),
  fee: AssetsFeeSchema,
});

export type RouteFeeOverride = z.infer<typeof RouteFeeOverrideSchema>;
