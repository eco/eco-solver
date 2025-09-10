import { z } from 'zod';

import { ProverTypeValues } from '@/common/interfaces/prover.interface';
import { AssetsFeeSchema } from '@/config/schemas/fee.schema';
import { SvmAddress } from '@/modules/blockchain/svm/types/address.types';

export const SvmAddressSchema = z.string().transform((v) => v as SvmAddress);

/**
 * EVM token configuration schema
 */
const SvmTokenSchema = z.object({
  address: SvmAddressSchema,
  decimals: z.coerce.number().int().min(0).max(18),
  limit: z
    .union([
      z.coerce.number().int().positive(), // Backward compatible: acts as max
      z
        .object({
          min: z.coerce.number().int().positive(),
          max: z.coerce.number().int().positive(),
        })
        .refine((data) => data.min <= data.max, {
          message: 'min must be less than or equal to max',
        }),
    ])
    .optional(),
});

/**
 * Solana configuration schema
 */
export const SolanaSchema = z.object({
  chainId: z.coerce.number().int().positive().default(1399811149),
  rpcUrl: z.string().url().default('https://api.mainnet-beta.solana.com'),
  wsUrl: z
    .string()
    .regex(/^wss?:/)
    .optional(),
  secretKey: z.string(), // alias for privateKey
  portalProgramId: SvmAddressSchema,
  provers: z.record(z.enum(ProverTypeValues), SvmAddressSchema),
  defaultProver: z.enum(ProverTypeValues),
  claimant: SvmAddressSchema, // Solana public key as base58 string (required)
  tokens: z.array(SvmTokenSchema).default([]),
  fee: AssetsFeeSchema,
});

export type SolanaConfig = z.infer<typeof SolanaSchema>;
