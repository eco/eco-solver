import { registerAs } from '@nestjs/config';

import { z } from 'zod';

import { DeepPartial } from '@/common/types';
import { AssetsFeeSchema } from '@/config/schemas/fee.schema';

/**
 * EVM network RPC configuration schema
 */
export const EvmRpcSchema = z.object({
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
        .default(true),
      timeout: z.number().int().positive().optional(),
      retryCount: z.number().int().min(0).optional(),
      retryDelay: z.number().int().positive().optional(),
    })
    .default({}),
});

/**
 * EVM network WebSocket configuration schema
 */
export const EvmWsSchema = z.object({
  urls: z.array(z.string().regex(/^wss?:/)),
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
  limit: z
    .union([
      z.number().int().positive(), // Backward compatible: acts as max
      z
        .object({
          min: z.number().int().positive(),
          max: z.number().int().positive(),
        })
        .refine((data) => data.min <= data.max, {
          message: 'min must be less than or equal to max',
        }),
    ])
    .optional(),
});

/**
 * Basic wallet configuration schema
 */
const BasicWalletConfigSchema = z.object({
  privateKey: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),
});

const KmsSignerConfigSchema = z.object({
  type: z.literal('kms'),
  keyID: z.string(),
  region: z.string(),
  credentials: z
    .object({
      accessKeyId: z.string(),
      secretAccessKey: z.string(),
    })
    .optional(),
});

const EOASignerConfigSchema = z.object({
  type: z.literal('eoa'),
  privateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

/**
 * Kernel wallet configuration schema
 */
const KernelWalletConfigSchema = z.object({
  signer: z.union([KmsSignerConfigSchema, EOASignerConfigSchema]),
});

/**
 * Wallets configuration schema - object with wallet type as keys
 */
const WalletsSchema = z.object({
  basic: BasicWalletConfigSchema,
  kernel: KernelWalletConfigSchema,
});

/**
 * EVM network configuration schema
 */
const EvmNetworkSchema = z.object({
  chainId: z.number().int().positive(),
  rpc: z.union([EvmRpcSchema, EvmWsSchema]),
  tokens: z.array(EvmTokenSchema).default([]),
  fee: AssetsFeeSchema,
  provers: z.record(
    z.enum(['hyper', 'metalayer'] as const),
    z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  ),
  contracts: z.object({
    portal: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    ecdsaExecutor: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional(),
  }),
});

/**
 * EVM configuration schema
 */
export const EvmSchema = z.object({
  networks: z.array(EvmNetworkSchema).default([]),
  wallets: WalletsSchema.default({
    basic: {},
  }),
});

export type EvmConfig = z.infer<typeof EvmSchema>;
export type EvmNetworkConfig = z.infer<typeof EvmNetworkSchema>;
export type EvmTokenConfig = z.infer<typeof EvmTokenSchema>;
export type EvmWalletsConfig = z.infer<typeof WalletsSchema>;
export type BasicWalletConfig = z.infer<typeof BasicWalletConfigSchema>;
export type KernelWalletConfig = z.infer<typeof KernelWalletConfigSchema>;
export type KmsSignerConfig = z.infer<typeof KmsSignerConfigSchema>;

/**
 * EVM configuration factory using registerAs
 * Returns empty object - env vars handled in configurationFactory
 */
export const evmConfig = registerAs<DeepPartial<EvmConfig>>('evm', () => ({}));
