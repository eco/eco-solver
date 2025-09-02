import { z } from 'zod';

/**
 * Solana configuration schema
 */
export const SolanaSchema = z.object({
  chainId: z.string().default('solana-mainnet'),
  rpcUrl: z.string().url().default('https://api.mainnet-beta.solana.com'),
  wsUrl: z
    .string()
    .regex(/^wss?:/)
    .optional(),
  secretKey: z.string(), // alias for privateKey
  walletAddress: z.string().optional(),
  programId: z.string(),
  portalProgramId: z.string(),
  claimant: z.string(), // Solana public key as base58 string (required)
});

export type SolanaConfig = z.infer<typeof SolanaSchema>;
