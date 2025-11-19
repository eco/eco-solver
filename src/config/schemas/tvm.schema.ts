import { z } from 'zod';

import { ProverTypeValues } from '@/common/interfaces/prover.interface';
import { AssetsFeeSchema } from '@/config/schemas/fee.schema';
import { RouteAmountLimitSchema } from '@/config/schemas/route-limit.schema';
import { TronAddress } from '@/modules/blockchain/tvm/types';

export const TronAddressSchema = z
  .string()
  .regex(/^T[a-zA-Z0-9]{33}$/)
  .transform((value) => value as TronAddress);

/**
 * TVM network RPC configuration schema
 */
export const TvmRpcSchema = z.object({
  fullNode: z.string().url(),
  solidityNode: z.string().url().optional(),
  eventServer: z.string().url().optional(),
  apiKey: z.string().optional(),
  options: z
    .object({
      timeout: z.coerce.number().int().positive().optional(),
      retryCount: z.coerce.number().int().min(0).optional(),
      retryDelay: z.coerce.number().int().positive().optional(),
    })
    .default({}),
});

/**
 * TVM token configuration schema
 */
const TvmTokenSchema = z.object({
  address: TronAddressSchema, // Tron address format
  decimals: z.coerce.number().int().min(0).max(18),
  symbol: z.string().min(1).max(20),
  limit: RouteAmountLimitSchema.optional(),
  fee: AssetsFeeSchema.optional(), // Token-specific fee configuration (highest priority)
  // Token-specific swap groups configuration (highest priority)
  nonSwapGroups: z.array(z.string()).optional(),
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
  chainId: z.coerce.number().int().positive(),
  rpc: TvmRpcSchema,
  tokens: z.array(TvmTokenSchema).default([]),
  fee: AssetsFeeSchema.optional(),
  provers: z.record(z.enum(ProverTypeValues), TronAddressSchema),
  defaultProver: z.enum(ProverTypeValues),
  contracts: z.object({
    portal: TronAddressSchema, // Portal contract address
    // Add TVM-specific contracts here if needed
  }),
  claimant: TronAddressSchema,
});

/**
 * TVM transaction settings schema
 */
const TvmTransactionSettingsSchema = z.object({
  defaultFeeLimit: z.coerce.number().int().positive().default(150000000), // 150 TRX in SUN
  maxTransactionAttempts: z.coerce.number().int().positive().default(30),
  transactionCheckInterval: z.coerce.number().int().positive().default(30_000), // milliseconds
  listenerPollInterval: z.coerce.number().int().positive().default(15_000), // milliseconds
  proverListenerInterval: z.coerce.number().int().positive().default(120_000), // milliseconds (2 minutes for prover events)
});

/**
 * TVM configuration schema
 */
export const TvmSchema = z.object({
  networks: z.array(TvmNetworkSchema).default([]),
  wallets: WalletsSchema,
  transactionSettings: TvmTransactionSettingsSchema.default({}),
  listenersEnabled: z.boolean().default(true),
});

export type TvmConfig = z.infer<typeof TvmSchema>;
export type TvmNetworkConfig = z.infer<typeof TvmNetworkSchema>;
export type TvmTokenConfig = z.infer<typeof TvmTokenSchema>;
export type TvmWalletsConfig = z.infer<typeof WalletsSchema>;
export type TvmTransactionSettings = z.infer<typeof TvmTransactionSettingsSchema>;
