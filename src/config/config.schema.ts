import { z } from 'zod';

/**
 * Zod schema for the application configuration
 * This schema defines the structure, types, and validation rules for all configuration
 */
export const ConfigSchema = z.object({
  env: z.enum(['development', 'production', 'test']).default('development'),
  port: z.number().int().positive().default(3000),

  mongodb: z.object({
    uri: z
      .string()
      .url()
      .or(z.string().regex(/^mongodb:/)),
  }),

  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().int().positive().default(6379),
    password: z.string().optional(),
  }),

  evm: z.object({
    rpcUrl: z.string().url(),
    wsUrl: z
      .string()
      .url()
      .or(z.string().regex(/^wss?:/)),
    chainId: z.number().int().positive(),
    privateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    walletAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional(),
    intentSourceAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    inboxAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  }),

  solana: z.object({
    rpcUrl: z.string().url().default('https://api.mainnet-beta.solana.com'),
    wsUrl: z
      .string()
      .url()
      .or(z.string().regex(/^wss?:/))
      .default('wss://api.mainnet-beta.solana.com'),
    secretKey: z.string(),
    walletAddress: z.string().optional(),
    programId: z.string(),
  }),

  queue: z.object({
    concurrency: z.number().int().min(1).default(5),
    attempts: z.number().int().min(0).default(3),
    backoffType: z.string().default('exponential'),
    backoffDelay: z.number().int().min(0).default(5000),
    maxRetriesPerRequest: z.number().int().min(0).optional(),
    retryDelayMs: z.number().int().min(0).optional(),
  }),

  aws: z.object({
    region: z.string().default('us-east-1'),
    secretName: z.string().default('blockchain-intent-solver-secrets'),
    useAwsSecrets: z.boolean().default(false),
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
  }),

  provers: z
    .array(
      z.object({
        type: z.enum(['hyper', 'metalayer']),
        chainConfigs: z.array(
          z.object({
            chainId: z.union([z.string(), z.number()]),
            contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
          }),
        ),
      }),
    )
    .default([]),

  fulfillment: z.object({
    defaultStrategy: z
      .enum(['standard', 'crowd-liquidity', 'native-intents', 'negative-intents', 'rhinestone'])
      .default('standard'),
    strategies: z
      .object({
        standard: z.object({
          enabled: z.boolean().default(true),
        }),
        crowdLiquidity: z.object({
          enabled: z.boolean().default(true),
        }),
        nativeIntents: z.object({
          enabled: z.boolean().default(true),
        }),
        negativeIntents: z.object({
          enabled: z.boolean().default(true),
        }),
        rhinestone: z.object({
          enabled: z.boolean().default(true),
        }),
      })
      .default({
        standard: { enabled: true },
        crowdLiquidity: { enabled: true },
        nativeIntents: { enabled: true },
        negativeIntents: { enabled: true },
        rhinestone: { enabled: true },
      }),
  }),
});

// Export the inferred TypeScript type
export type Config = z.infer<typeof ConfigSchema>;

// Export individual sub-schemas for reuse
export const MongoDBSchema = ConfigSchema.shape.mongodb;
export const RedisSchema = ConfigSchema.shape.redis;
export const EvmSchema = ConfigSchema.shape.evm;
export const SolanaSchema = ConfigSchema.shape.solana;
export const QueueSchema = ConfigSchema.shape.queue;
export const AwsSchema = ConfigSchema.shape.aws;
export const ProversSchema = ConfigSchema.shape.provers;
export const FulfillmentSchema = ConfigSchema.shape.fulfillment;
