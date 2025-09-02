import { z } from 'zod';

/**
 * Solana configuration schema
 */
export const SolanaSchema = z
  .object({
    chainId: z.string().default('solana-mainnet'),
    rpcUrl: z.string().url().default('https://api.mainnet-beta.solana.com'),
    wsUrl: z
      .string()
      .regex(/^wss?:/)
      .optional(),
    privateKey: z.string().optional(),
    secretKey: z.string().optional(), // alias for privateKey
    walletAddress: z.string().optional(),
    programId: z.string().optional(),
    portalProgramId: z.string().optional(),
    claimant: z.string(), // Solana public key as base58 string (required)
  })
  .optional();

export type SolanaConfig = z.infer<typeof SolanaSchema>;
