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
    privateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    walletAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional(),
    defaultChainId: z.number().int().positive(),
    networks: z
      .array(
        z.object({
          chainId: z.number().int().positive(),
          rpc: z.object({
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
          }),
          ws: z
            .object({
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
            })
            .optional(),
          intentSourceAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
          inboxAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
          tokens: z
            .array(
              z.object({
                address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
                decimals: z.number().int().min(0).max(18),
                limit: z.string(), // Using string for bigint compatibility
              }),
            )
            .default([]),
          feeLogic: z.object({
            baseFlatFee: z.string(), // Using string for bigint compatibility (in wei)
            scalarBps: z.number().int().min(0).max(10000), // Basis points (0-10000 = 0-100%)
          }),
        }),
      )
      .default([]),
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
