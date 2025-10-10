import { z } from 'zod'

/**
 * Centralized configuration schemas based on EcoConfigType structure
 * This eliminates duplication across validation services
 */
export class ConfigurationSchemas {
  /**
   * Get all configuration schemas as a record
   */
  static getAllSchemas(): Record<string, z.ZodSchema> {
    return {
      // Top-level scalar configurations
      port: z.number().int().min(1).max(65535),

      // Server configuration (ServerConfig)
      server: z.object({
        url: z.string().url(),
      }),

      // Database configuration (from EcoConfigType.database) - made more flexible
      database: z
        .object({
          auth: z
            .object({
              enabled: z.boolean().optional(),
              username: z.string().optional(),
              password: z.string().optional(),
              type: z.string().optional(),
            })
            .optional(),
          uriPrefix: z.string().optional(),
          uri: z.string().optional(),
          dbName: z.string().optional(),
          enableJournaling: z.boolean().optional(),
        })
        .loose(), // Allow additional properties

      // AWS configuration (AwsCredential[])
      aws: z.array(
        z.object({
          region: z.string(),
          secretID: z.string(),
        }),
      ),

      // KMS configuration (KmsConfig)
      kms: z.object({
        region: z.string(),
        keyID: z.string(),
      }),

      // Launch Darkly configuration (LaunchDarklyConfig)
      launchDarkly: z.object({
        apiKey: z.string().min(1),
        options: z.object({}).optional(),
      }),

      // Ethereum configuration (from EcoConfigType.eth) - made more flexible
      eth: z
        .object({
          privateKey: z
            .string()
            .regex(/^0x[a-fA-F0-9]{64}$/)
            .optional(),
          simpleAccount: z
            .object({
              walletAddr: z
                .string()
                .regex(/^0x[a-fA-F0-9]{40}$/)
                .optional(),
              signerPrivateKey: z
                .string()
                .regex(/^0x[a-fA-F0-9]{64}$/)
                .optional(),
              minEthBalanceWei: z.number().optional(),
            })
            .optional(),
          claimant: z
            .string()
            .regex(/^0x[a-fA-F0-9]{40}$/)
            .optional(),
          nonce: z
            .object({
              update_interval_ms: z.number(),
            })
            .optional(),
          pollingInterval: z.number().optional(),
        })
        .loose(), // Allow additional properties

      // Other top-level configurations (simplified schemas for now)
      analytics: z.object({}),
      redis: z.object({}),
      rpcs: z.object({}),
      solvers: z.record(z.string(), z.object({})),
      intentSources: z.array(z.object({})),
      cache: z.object({}),
      intervals: z.object({}),
      quotesConfig: z.object({}),
      solverRegistrationConfig: z.object({}),
      intentConfigs: z.object({}),
      fulfillmentEstimate: z.object({}),
      fulfill: z.object({}),
      safe: z.object({}),
      whitelist: z.object({}),
      logger: z.object({}),
      liquidityManager: z.object({}),
      liFi: z.object({}),
      indexer: z.object({}),
      withdraws: z.object({}),
      sendBatch: z.object({}),
      hyperlane: z.object({}),
      crowdLiquidity: z.object({}),
      CCTP: z.object({}),
      warpRoutes: z.object({}),
      cctpLiFi: z.object({}),
      squid: z.object({}),
      CCTPV2: z.object({}),
      everclear: z.object({}),
      gateway: z.object({}),
      watch: z.object({}),
      usdt0: z.object({}),
      gasEstimations: z.object({}),
      externalAPIs: z.unknown(),

      // Additional schemas for configurations found in AWS
      gitApp: z.object({}).loose(),
      alchemy: z.object({}).loose(),
      fulfillment: z.object({}).loose(),
      monitor: z.object({}).loose(),
      WETH: z.object({}).loose(),
      rhinestone: z.object({}).loose(),
    }
  }

  /**
   * Get a specific schema by key
   */
  static getSchema(key: string): z.ZodSchema | null {
    const schemas = this.getAllSchemas()
    return schemas[key] || null
  }

  /**
   * Get all schema keys
   */
  static getSchemaKeys(): string[] {
    return Object.keys(this.getAllSchemas())
  }

  /**
   * Check if a schema exists for a given key
   */
  static hasSchema(key: string): boolean {
    return key in this.getAllSchemas()
  }
}
