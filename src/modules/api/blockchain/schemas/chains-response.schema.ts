import { z } from 'zod';

export const WalletInfoSchema = z.object({
  type: z.string().describe('The type of wallet (e.g., basic, kernel)'),
  address: z.string().describe('The wallet address'),
  metadata: z.record(z.string()).optional().describe('Additional wallet metadata'),
});

export const TokenInfoSchema = z.object({
  address: z.string().describe('The token address in chain-native format'),
  decimals: z.number().describe('The number of decimals for the token'),
  symbol: z.string().describe('The token symbol (e.g., USDC, ETH, SOL)'),
});

export const ChainInfoSchema = z.object({
  chainId: z.number().describe('The chain ID'),
  chainName: z.string().optional().describe('The name of the chain'),
  chainType: z.enum(['EVM', 'SVM', 'TVM']).describe('The type of blockchain'),
  wallets: z.array(WalletInfoSchema).describe('List of wallets configured for this chain'),
  tokens: z.array(TokenInfoSchema).describe('List of supported tokens on this chain'),
});

export const ChainsResponseSchema = z.array(ChainInfoSchema);

export type WalletInfo = z.infer<typeof WalletInfoSchema>;
export type TokenInfo = z.infer<typeof TokenInfoSchema>;
export type ChainInfo = z.infer<typeof ChainInfoSchema>;
export type ChainsResponse = z.infer<typeof ChainsResponseSchema>;
