import { registerAs } from '@nestjs/config';
import { z } from 'zod';

import { DeepPartial } from '@/common/types';

/**
 * EVM network RPC configuration schema
 */
const EvmRpcSchema = z.object({
  urls: z.array(z.string().url()),
  options: z
    .object({
      batch: z
        .union([
          z.boolean(),
          z.object({
            multicall: z.boolean().optional(),
            batchSize: z.number().int().positive().optional(),
            wait: z.number().int().positive().optional(),
          }),
        ])
        .optional(),
      timeout: z.number().int().positive().optional(),
      retryCount: z.number().int().min(0).optional(),
      retryDelay: z.number().int().positive().optional(),
    })
    .optional(),
});

/**
 * EVM network WebSocket configuration schema
 */
const EvmWsSchema = z.object({
  urls: z.array(
    z
      .string()
      .url()
      .or(z.string().regex(/^wss?:/)),
  ),
  options: z
    .object({
      timeout: z.number().int().positive().optional(),
      keepAlive: z.boolean().optional(),
      reconnect: z
        .union([
          z.boolean(),
          z.object({
            auto: z.boolean().optional(),
            delay: z.number().int().positive().optional(),
            maxAttempts: z.number().int().positive().optional(),
          }),
        ])
        .optional(),
    })
    .optional(),
});

/**
 * EVM token configuration schema
 */
const EvmTokenSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  decimals: z.number().int().min(0).max(18),
  limit: z.string(), // Using string for bigint compatibility
});

/**
 * EVM fee logic configuration schema
 */
const EvmFeeLogicSchema = z.object({
  baseFlatFee: z.string(), // Using string for bigint compatibility (in wei)
  scalarBps: z.number().int().min(0).max(10000), // Basis points (0-10000 = 0-100%)
});

/**
 * EVM network configuration schema
 */
const EvmNetworkSchema = z.object({
  chainId: z.number().int().positive(),
  rpc: EvmRpcSchema,
  ws: EvmWsSchema.optional(),
  intentSourceAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  inboxAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  tokens: z.array(EvmTokenSchema).default([]),
  feeLogic: EvmFeeLogicSchema,
});

/**
 * EVM configuration schema
 */
export const EvmSchema = z.object({
  privateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  networks: z.array(EvmNetworkSchema).default([]),
});

export type EvmConfig = z.infer<typeof EvmSchema>;
export type EvmNetworkConfig = z.infer<typeof EvmNetworkSchema>;
export type EvmTokenConfig = z.infer<typeof EvmTokenSchema>;
export type EvmFeeLogicConfig = z.infer<typeof EvmFeeLogicSchema>;

/**
 * EVM configuration factory using registerAs
 * Returns empty object - env vars handled in configurationFactory
 */
export const evmConfig = registerAs<DeepPartial<EvmConfig>>('evm', () => ({}));