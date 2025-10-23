import { z } from 'zod';

/**
 * Fee logic configuration schema
 *
 * IMPORTANT: flatFee format depends on usage context:
 * - For tokens.flatFee: DECIMAL format (e.g., 0.001) - normalized to 18 decimals via parseUnits
 * - For native.flatFee: WEI format (e.g., 1000000000000000) - used directly as BigInt
 */
const FeeSchema = z.object({
  flatFee: z.coerce.number().min(0), // Format: decimal for tokens, wei for native (see above)
  scalarBps: z.coerce.number().min(0).max(10000), // Basis points (0-10000 = 0-100%)
});

export const AssetsFeeSchema = z.object({
  tokens: FeeSchema,
  native: FeeSchema.optional(),
});

export type AssetsFeeSchemaType = z.infer<typeof AssetsFeeSchema>;
