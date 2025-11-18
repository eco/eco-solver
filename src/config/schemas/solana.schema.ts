import { z } from 'zod';

import { ProverTypeValues } from '@/common/interfaces/prover.interface';
import { AssetsFeeSchema } from '@/config/schemas/fee.schema';
import { SvmAddress } from '@/modules/blockchain/svm/types/address.types';

export const SvmAddressSchema = z.string().transform((v) => v as SvmAddress);

/**
 * EVM token configuration schema
 */
const SvmTokenSchema = z.object({
  address: SvmAddressSchema,
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
  fee: AssetsFeeSchema.optional(), // Token-specific fee configuration (highest priority)
  // Token-specific swap groups configuration (highest priority)
  nonSwapGroups: z.array(z.string()).optional(),
});

/**
 * Hyperlane configuration schema for SVM
 */
const HyperlaneSchema = z.object({
  mailbox: SvmAddressSchema,
  noop: SvmAddressSchema,
  igpProgram: SvmAddressSchema,
  igpAccount: SvmAddressSchema,
  overheadIgpAccount: SvmAddressSchema,
});

/**
 * Token auth configuration for HashiCorp Vault
 */
const VaultTokenAuthSchema = z.object({
  type: z.literal('token'),
  token: z.string(),
});

/**
 * Kubernetes auth configuration for HashiCorp Vault
 */
const VaultKubernetesAuthSchema = z
  .object({
    type: z.literal('kubernetes'),
    role: z.string(),
    mountPoint: z.string().default('kubernetes'),
    jwt: z.string().optional(), // Optional: reads from service account if not provided
    jwtPath: z.string().optional(), // Optional: reads from service account if not provided
  })
  .refine((data) => data.jwt || data.jwtPath, {
    message: "Either 'jwt' or 'jwtPath' must be provided",
  });

/**
 * Union of Vault authentication methods
 */
const VaultAuthSchema = z.union([VaultTokenAuthSchema, VaultKubernetesAuthSchema]);

/**
 * Basic wallet configuration with private key
 */
const BasicWalletTypeConfigSchema = z.object({
  type: z.literal('basic'),
  secretKey: z.string(), // base58 encoded private key
});

/**
 * Vault wallet configuration using HashiCorp Vault Transit Secrets Engine
 */
const VaultWalletTypeConfigSchema = z.object({
  type: z.literal('vault'),
  endpoint: z.string().url(),
  transitPath: z.string().default('transit'),
  keyName: z.string(),
  auth: VaultAuthSchema,
});

/**
 * Discriminated union of wallet configurations
 */
const BasicWalletConfigSchema = z.union([BasicWalletTypeConfigSchema, VaultWalletTypeConfigSchema]);

/**
 * Wallets configuration schema
 */
const WalletsSchema = z.object({
  basic: BasicWalletConfigSchema,
});

/**
 * Solana configuration schema
 */
export const SolanaSchema = z.object({
  chainId: z.coerce.number().int().positive().default(1399811149),
  rpcUrl: z.string().url().default('https://api.mainnet-beta.solana.com'),
  wsUrl: z
    .string()
    .regex(/^wss?:/)
    .optional(),
  wallets: WalletsSchema,
  portalProgramId: SvmAddressSchema,
  provers: z.record(z.enum(ProverTypeValues), SvmAddressSchema),
  defaultProver: z.enum(ProverTypeValues),
  claimant: SvmAddressSchema, // Solana public key as base58 string (required)
  tokens: z.array(SvmTokenSchema).default([]),
  fee: AssetsFeeSchema.optional(),
  listenersEnabled: z.boolean().default(true),
  hyperlane: HyperlaneSchema.optional(),
  proofPolling: z
    .object({
      enabled: z.coerce.boolean().default(true),
      intervalSeconds: z.coerce.number().int().positive().default(30),
      batchSize: z.coerce.number().int().positive().default(100),
    })
    .optional(),
});

export type SolanaConfig = z.infer<typeof SolanaSchema>;
export type VaultAuthConfig = z.infer<typeof VaultAuthSchema>;
