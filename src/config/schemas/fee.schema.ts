import { registerAs } from '@nestjs/config';

import { z } from 'zod';

import { DeepPartial } from '@/common/types';

/**
 * fee logic configuration schema
 */
const FeeSchema = z.object({
  flatFee: z.number().min(0), // Using string for bigint compatibility (in wei)
  scalarBps: z.number().min(0).max(10000), // Basis points (0-10000 = 0-100%)
});

/**
 * fee logic configuration schema
 */
export const AssetsFeeSchema = z.object({
  tokens: FeeSchema,
  native: FeeSchema.optional(),
});

export type AssetsFeeSchemaType = z.infer<typeof AssetsFeeSchema>;
