import { registerAs } from '@nestjs/config';
import { z } from 'zod';

/**
 * Solana configuration schema
 */
export const SolanaSchema = z.object({
  rpcUrl: z.string().url().default('https://api.mainnet-beta.solana.com'),
  wsUrl: z
    .string()
    .url()
    .or(z.string().regex(/^wss?:/))
    .default('wss://api.mainnet-beta.solana.com'),
  secretKey: z.string(),
  walletAddress: z.string().optional(),
  programId: z.string(),
});

export type SolanaConfig = z.infer<typeof SolanaSchema>;

/**
 * Solana configuration factory using registerAs
 * Provides default values from Zod schema
 */
export const solanaConfig = registerAs('solana', () => {
  return SolanaSchema.parse({
    rpcUrl: process.env.SOLANA_RPC_URL,
    wsUrl: process.env.SOLANA_WEBSOCKET_URL,
    secretKey: process.env.SOLANA_SECRET_KEY,
    walletAddress: process.env.SOLANA_WALLET_ADDRESS,
    programId: process.env.SOLANA_PROGRAM_ID,
  });
});