import { z } from 'zod'

// Simple generic schemas - inline for now to avoid import issues
const ServerConfigSchema = z.object({
  url: z.string().url().optional(),
  port: z.number().int().min(1000).max(65535).optional(),
  host: z.string().default('localhost').optional(),
  enableHttps: z.boolean().default(false).optional(),
  requestTimeout: z.number().positive().default(30000).optional(),
})

const AwsConfigSchema = z.object({
  region: z.string().min(1),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  secretID: z.string().optional(),
  secretsManager: z
    .object({
      enabled: z.boolean().default(false),
      secrets: z.array(z.string()).default([]),
    })
    .optional(),
})

const CacheConfigSchema = z.object({
  ttl: z.number().positive().default(300000),
  max: z.number().positive().default(100).optional(),
})

const DatabaseConfigSchema = z.object({
  host: z.string().min(1).optional(),
  port: z.number().int().positive().optional(),
  database: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  ssl: z.boolean().default(true).optional(),
  pool: z
    .object({
      min: z.number().int().nonnegative().default(2),
      max: z.number().int().positive().default(10),
    })
    .optional(),
})

// Eco-solver specific schemas
export const SolverConfigSchema = z.object({
  chainID: z.number(),
  inboxAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  network: z.string(),
  targets: z.record(
    z.string(),
    z.object({
      contractType: z.enum(['erc20', 'erc721', 'erc1155']),
      selectors: z.array(z.string()),
      minBalance: z.number(),
      targetBalance: z.number().optional(),
    }),
  ),
  fee: z
    .object({
      limit: z.object({
        tokenBase6: z.bigint(),
        nativeBase18: z.bigint(),
      }),
      algorithm: z.enum(['linear', 'quadratic']),
      constants: z.any(),
    })
    .optional(),
  averageBlockTime: z.number(),
  gasOverhead: z.number().optional(),
})

export const IntentSourceSchema = z.object({
  network: z.string(),
  chainID: z.number(),
  sourceAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  inbox: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  tokens: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)),
  provers: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)).optional(),
  config: z
    .object({
      ecoRoutes: z.enum(['append', 'replace']),
    })
    .optional(),
})

// Redis specific schema
export const RedisConfigSchema = z.object({
  connection: z
    .object({
      host: z.string(),
      port: z.number(),
    })
    .optional(),
  options: z
    .object({
      single: z
        .object({
          autoResubscribe: z.boolean(),
          autoResendUnfulfilledCommands: z.boolean(),
          tls: z.record(z.any()),
        })
        .optional(),
      cluster: z
        .object({
          enableReadyCheck: z.boolean(),
          retryDelayOnClusterDown: z.number(),
          retryDelayOnFailover: z.number(),
          retryDelayOnTryAgain: z.number(),
          slotsRefreshTimeout: z.number(),
          clusterRetryStrategy: z.function().args(z.number()).returns(z.number()),
          dnsLookup: z.function(),
        })
        .optional(),
    })
    .optional(),
  redlockSettings: z
    .object({
      driftFactor: z.number(),
      retryCount: z.number(),
      retryDelay: z.number(),
      retryJitter: z.number(),
    })
    .optional(),
  jobs: z
    .object({
      intentJobConfig: z
        .object({
          removeOnComplete: z.boolean(),
          removeOnFail: z.boolean(),
          attempts: z.number(),
          backoff: z.object({
            type: z.string(),
            delay: z.number(),
          }),
        })
        .optional(),
      watchJobConfig: z
        .object({
          removeOnComplete: z.boolean(),
          removeOnFail: z.boolean(),
          attempts: z.number(),
          backoff: z.object({
            type: z.string(),
            delay: z.number(),
          }),
        })
        .optional(),
    })
    .optional(),
})

// RPC configuration schema
export const RpcConfigSchema = z.object({
  keys: z.record(z.string(), z.string()),
  config: z
    .object({
      webSockets: z.boolean().optional(),
    })
    .optional(),
  custom: z.record(z.string(), z.any()).optional(),
})

// Intervals configuration schema
export const IntervalsConfigSchema = z.object({
  retryInfeasableIntents: z
    .object({
      repeatOpts: z.object({
        every: z.number(),
      }),
      jobTemplate: z.object({
        name: z.string(),
        data: z.record(z.any()),
      }),
    })
    .optional(),
  defaults: z
    .object({
      repeatOpts: z.object({
        every: z.number(),
      }),
      jobTemplate: z.object({
        name: z.string(),
        data: z.record(z.any()),
        opts: z.object({
          removeOnComplete: z.boolean(),
          removeOnFail: z.boolean(),
          attempts: z.number(),
          backoff: z.object({
            type: z.string(),
            delay: z.number(),
          }),
        }),
      }),
    })
    .optional(),
})

// Logger configuration schema
export const LoggerConfigSchema = z.object({
  usePino: z.boolean(),
  pinoConfig: z
    .object({
      pinoHttp: z.object({
        level: z.string(),
        useLevelLabels: z.boolean(),
        redact: z.object({
          paths: z.array(z.string()),
          remove: z.boolean(),
        }),
      }),
    })
    .optional(),
})

// Intent configuration schema
export const IntentConfigSchema = z.object({
  defaultFee: z.object({
    limit: z.object({
      tokenBase6: z.bigint(),
      nativeBase18: z.bigint(),
    }),
    algorithm: z.enum(['linear', 'quadratic']),
    constants: z.object({
      token: z.object({
        baseFee: z.bigint(),
        tranche: z.object({
          unitFee: z.bigint(),
          unitSize: z.bigint(),
        }),
      }),
      native: z.object({
        baseFee: z.bigint(),
        tranche: z.object({
          unitFee: z.bigint(),
          unitSize: z.bigint(),
        }),
      }),
    }),
  }),
  proofs: z.object({
    hyperlane_duration_seconds: z.number(),
    metalayer_duration_seconds: z.number(),
  }),
  intentFundedRetries: z.number(),
  intentFundedRetryDelayMs: z.number(),
  defaultGasOverhead: z.number(),
})

// CCTP configuration schema
export const CCTPConfigSchema = z.object({
  apiUrl: z.string().url(),
  chains: z.array(
    z.object({
      chainId: z.number(),
      domain: z.number(),
      token: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      tokenMessenger: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      messageTransmitter: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    }),
  ),
})

// Database configuration schema specific to eco-solver
export const EcoSolverDatabaseConfigSchema = z.object({
  auth: z.object({
    enabled: z.boolean(),
    username: z.string(),
    password: z.string(),
    type: z.string(),
  }),
  uriPrefix: z.string(),
  uri: z.string(),
  dbName: z.string(),
  enableJournaling: z.boolean(),
})

// Complete eco-solver config schema using generic base schemas
export const EcoSolverConfigSchema = z.object({
  // Use generic schemas from @libs/config
  server: ServerConfigSchema.optional(),
  aws: z.array(AwsConfigSchema).optional(),
  cache: CacheConfigSchema.optional(),
  database: EcoSolverDatabaseConfigSchema.optional(),

  // Add eco-solver specific sections
  solvers: z.record(z.number(), SolverConfigSchema).optional(),
  intentSources: z.array(IntentSourceSchema).optional(),
  rpcs: RpcConfigSchema.optional(),
  redis: RedisConfigSchema.optional(),
  intervals: IntervalsConfigSchema.optional(),
  logger: LoggerConfigSchema.optional(),
  intentConfigs: IntentConfigSchema.optional(),

  // External service configurations
  fulfill: z.any().optional(), // Define more specific schemas as needed
  kms: z.any().optional(),
  safe: z.any().optional(),
  launchDarkly: z.any().optional(),
  analytics: z.any().optional(),
  eth: z.any().optional(),
  CCTP: CCTPConfigSchema.optional(),
  CCTPV2: CCTPConfigSchema.optional(),
  hyperlane: z
    .object({
      useHyperlaneDefaultHook: z.boolean(),
    })
    .optional(),

  // Additional eco-solver specific config sections
  quotesConfig: z
    .object({
      intentExecutionTypes: z.array(z.string()),
    })
    .optional(),
  gaslessIntentdAppIDs: z.array(z.string()).optional(),
  whitelist: z.record(z.any()).optional(),
  fulfillmentEstimate: z
    .object({
      executionPaddingSeconds: z.number(),
      blockTimePercentile: z.number(),
      defaultBlockTime: z.number(),
    })
    .optional(),
  gasEstimations: z
    .object({
      fundFor: z.bigint(),
      permit: z.bigint(),
      permit2: z.bigint(),
      defaultGasPriceGwei: z.string(),
    })
    .optional(),
  indexer: z
    .object({
      url: z.string().url(),
    })
    .optional(),
  withdraws: z
    .object({
      chunkSize: z.number(),
      intervalDuration: z.number(),
    })
    .optional(),
  sendBatch: z
    .object({
      chunkSize: z.number(),
      intervalDuration: z.number(),
      defaultGasPerIntent: z.number(),
    })
    .optional(),
  externalAPIs: z.record(z.any()).optional(),
  squid: z
    .object({
      baseUrl: z.string().url(),
    })
    .optional(),
  everclear: z
    .object({
      baseUrl: z.string().url(),
    })
    .optional(),
  solverRegistrationConfig: z
    .object({
      apiOptions: z.object({
        baseUrl: z.string().url(),
      }),
    })
    .optional(),
})

export type EcoSolverConfigType = z.infer<typeof EcoSolverConfigSchema>
export type Solver = z.infer<typeof SolverConfigSchema>
export type IntentSource = z.infer<typeof IntentSourceSchema>
export type RpcConfig = z.infer<typeof RpcConfigSchema>
export type RedisConfig = z.infer<typeof RedisConfigSchema>
export type IntentConfig = z.infer<typeof IntentConfigSchema>
export type CCTPConfig = z.infer<typeof CCTPConfigSchema>
export type EcoSolverDatabaseConfig = z.infer<typeof EcoSolverDatabaseConfigSchema>
