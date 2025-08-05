import { registerAs } from '@nestjs/config';

import { z } from 'zod';

import { DeepPartial } from '@/common/types';

/**
 * Solana configuration schema
 */
export const SolanaSchema = z
  .object({
    rpcUrl: z.string().url().default('https://api.mainnet-beta.solana.com'),
    wsUrl: z
      .string()
      .url()
      .or(z.string().regex(/^wss?:/))
      .default('wss://api.mainnet-beta.solana.com'),
    secretKey: z.string(),
    walletAddress: z.string().optional(),
    programId: z.string(),
  })
  .optional();

export type SolanaConfig = z.infer<typeof SolanaSchema>;

/**
 * Solana configuration factory using registerAs
 * Returns empty object - env vars handled in configurationFactory
 */
export const solanaConfig = registerAs<DeepPartial<SolanaConfig>>('solana', () => undefined);
