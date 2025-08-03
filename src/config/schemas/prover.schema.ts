import { registerAs } from '@nestjs/config';
import { z } from 'zod';

/**
 * Prover chain configuration schema
 */
const ProverChainConfigSchema = z.object({
  chainId: z.union([z.string(), z.number()]),
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

/**
 * Prover configuration schema
 */
const ProverConfigSchema = z.object({
  type: z.enum(['hyper', 'metalayer']),
  chainConfigs: z.array(ProverChainConfigSchema),
});

/**
 * Provers configuration schema
 */
export const ProversSchema = z.array(ProverConfigSchema).default([]);

export type ProverConfig = z.infer<typeof ProverConfigSchema>;
export type ProverChainConfig = z.infer<typeof ProverChainConfigSchema>;
export type ProversConfig = z.infer<typeof ProversSchema>;

/**
 * Provers configuration factory using registerAs
 * Returns empty object - env vars handled in configurationFactory
 */
export const proversConfig = registerAs('provers', () => ({}));