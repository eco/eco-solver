import { z } from 'zod';

import { SvmAddress } from '@/modules/blockchain/svm/types/address.types';

export const SvmAddressSchema = z.string().transform((v) => v as SvmAddress);

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
  walletAddress: SvmAddressSchema.optional(),
  programId: SvmAddressSchema,
  portalProgramId: SvmAddressSchema,
  claimant: z.string(), // Solana public key as base58 string (required)
});

export type SolanaConfig = z.infer<typeof SolanaSchema>;
