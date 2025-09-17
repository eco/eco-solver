import { Address } from 'viem';
import { z } from 'zod';

import { ProverTypeValues } from '@/common/interfaces/prover.interface';
import { AssetsFeeSchema } from '@/config/schemas/fee.schema';

export const EvmAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/)
  .transform((v) => v as Address);

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
            batchSize: z.coerce.number().int().positive().optional(),
            wait: z.coerce.number().int().positive().optional(),
          }),
        ])
        .default(true),
      timeout: z.coerce.number().int().positive().optional(),
      retryCount: z.coerce.number().int().min(0).optional(),
      retryDelay: z.coerce.number().int().positive().optional(),
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
      timeout: z.coerce.number().int().positive().optional(),
      keepAlive: z.boolean().optional(),
      reconnect: z
        .union([
          z.boolean(),
          z.object({
            auto: z.boolean().optional(),
            delay: z.coerce.number().int().positive().optional(),
            maxAttempts: z.coerce.number().int().positive().optional(),
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
  address: EvmAddressSchema,
  decimals: z.coerce.number().int().min(0).max(18),
  symbol: z.string().min(1).max(20),
  limit: z
    .union([
      z.coerce.number().int().positive(), // Backward compatible: acts as max
      z
        .object({
          min: z.coerce.number().int().positive(),
          max: z.coerce.number().int().positive(),
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
 * Wallets configuration schema - object with a wallet type as keys
 */
const WalletsSchema = z.object({
  basic: BasicWalletConfigSchema,
  kernel: KernelWalletConfigSchema,
});

/**
 * EVM network configuration schema
 */
const EvmNetworkSchema = z.object({
  chainId: z.coerce.number().int().positive(),
  rpc: z.union([EvmRpcSchema, EvmWsSchema]),
  tokens: z.array(EvmTokenSchema).default([]),
  fee: AssetsFeeSchema,
  provers: z.record(z.enum(ProverTypeValues), EvmAddressSchema),
  defaultProver: z.enum(ProverTypeValues),
  contracts: z.object({
    portal: EvmAddressSchema,
    ecdsaExecutor: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional(),
  }),
  claimant: EvmAddressSchema,
});

/**
 * EVM configuration schema
 */
export const EvmSchema = z.object({
  networks: z.array(EvmNetworkSchema).default([]),
  wallets: WalletsSchema,
  listenersEnabled: z.boolean().default(true),
});

export type EvmConfig = z.infer<typeof EvmSchema>;
export type EvmNetworkConfig = z.infer<typeof EvmNetworkSchema>;
export type EvmTokenConfig = z.infer<typeof EvmTokenSchema>;
export type EvmWalletsConfig = z.infer<typeof WalletsSchema>;
export type KernelWalletConfig = z.infer<typeof KernelWalletConfigSchema>;
export type KmsSignerConfig = z.infer<typeof KmsSignerConfigSchema>;
