import { registerAs } from '@nestjs/config';

import { z } from 'zod';

import { DeepPartial } from '@/common/types';

/**
 * TVM network RPC configuration schema
 */
export const TvmRpcSchema = z.object({
  fullNode: z.string().url(),
  solidityNode: z.string().url().optional(),
  eventServer: z.string().url().optional(),
  options: z
    .object({
      timeout: z.number().int().positive().optional(),
      retryCount: z.number().int().min(0).optional(),
      retryDelay: z.number().int().positive().optional(),
    })
    .default({}),
});

/**
 * TVM token configuration schema
 */
const TvmTokenSchema = z.object({
  address: z.string().regex(/^T[a-zA-Z0-9]{33}$/), // Tron address format
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
 * TVM fee logic configuration schema
 */
const TvmFeeSchema = z.object({
  tokens: z.object({
    flatFee: z.string(), // Using string for bigint compatibility (in sun)
    scalarBps: z.number().min(0).max(10000), // Basis points (0-10000 = 0-100%)
  }),
  native: z
    .object({
      flatFee: z.string(), // Using string for bigint compatibility (in sun)
      scalarBps: z.number().min(0).max(10000), // Basis points (0-10000 = 0-100%)
    })
    .optional(),
});

/**
 * Basic wallet configuration schema for TVM
 */
const BasicWalletConfigSchema = z.object({
  privateKey: z.string(), // Tron private keys are hex strings without 0x prefix
});

/**
 * Wallets configuration schema - object with wallet type as keys
 */
const WalletsSchema = z.object({
  basic: BasicWalletConfigSchema,
});

/**
 * TVM network configuration schema
 */
const TvmNetworkSchema = z.object({
  chainId: z.union([
    z.number().int().positive(),
    z.string(), // Support string chain IDs like 'tron-mainnet'
  ]),
  rpc: TvmRpcSchema,
  intentSourceAddress: z.string().regex(/^T[a-zA-Z0-9]{33}$/), // Tron contract address
  inboxAddress: z.string().regex(/^T[a-zA-Z0-9]{33}$/), // Tron contract address
  tokens: z.array(TvmTokenSchema).default([]),
  fee: TvmFeeSchema,
  provers: z.record(
    z.enum(['hyper', 'metalayer'] as const),
    z.string().regex(/^T[a-zA-Z0-9]{33}$/),
  ),
  contracts: z
    .object({
      // Add TVM-specific contracts here if needed
    })
    .optional(),
});

/**
 * TVM transaction settings schema
 */
const TvmTransactionSettingsSchema = z.object({
  defaultFeeLimit: z.number().int().positive().default(150000000), // 150 TRX in SUN
  maxTransactionAttempts: z.number().int().positive().default(30),
  transactionCheckInterval: z.number().int().positive().default(2000), // milliseconds
  listenerPollInterval: z.number().int().positive().default(3000), // milliseconds
});

/**
 * TVM configuration schema
 */
export const TvmSchema = z.object({
  networks: z.array(TvmNetworkSchema).default([]),
  wallets: WalletsSchema.default({
    basic: {},
  }),
  transactionSettings: TvmTransactionSettingsSchema.default({}),
});

export type TvmConfig = z.infer<typeof TvmSchema>;
export type TvmNetworkConfig = z.infer<typeof TvmNetworkSchema>;
export type TvmTokenConfig = z.infer<typeof TvmTokenSchema>;
export type TvmFeeLogicConfig = z.infer<typeof TvmFeeSchema>;
export type TvmWalletsConfig = z.infer<typeof WalletsSchema>;
export type TvmBasicWalletConfig = z.infer<typeof BasicWalletConfigSchema>;
export type TvmTransactionSettings = z.infer<typeof TvmTransactionSettingsSchema>;

/**
 * TVM configuration factory using registerAs
 * Returns empty object - env vars handled in configurationFactory
 */
export const tvmConfig = registerAs<DeepPartial<TvmConfig>>('tvm', () => ({}));