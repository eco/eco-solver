import { z } from 'zod'

export const RedisConfigSchema = z.object({
  options: z.object({
    host: z.string().default('localhost'),
    port: z.number().int().min(1).max(65535).default(6379),
    password: z.string().optional(),
    db: z.number().int().min(0).default(0),
    retryAttempts: z.number().int().min(0).default(3),
    retryDelayOnFailover: z.number().int().min(0).default(100),
  }).passthrough(), // Allow additional Redis options
  redlockSettings: z.object({
    driftFactor: z.number().min(0).max(1).default(0.01),
    retryCount: z.number().int().min(0).default(3),
    retryDelay: z.number().int().min(0).default(200),
    retryJitter: z.number().int().min(0).default(200),
  }).passthrough(),
  jobs: z.object({
    defaultJobOptions: z.object({
      removeOnComplete: z.number().int().min(0).default(50),
      removeOnFail: z.number().int().min(0).default(100),
      attempts: z.number().int().min(1).default(3),
      backoff: z.object({
        type: z.enum(['fixed', 'exponential']).default('exponential'),
        delay: z.number().int().min(0).default(2000),
      }).optional(),
    }).passthrough(),
  }).passthrough(),
})

export type RedisConfig = z.infer<typeof RedisConfigSchema>

export const validateRedisConfig = (data: unknown): RedisConfig => {
  const result = RedisConfigSchema.safeParse(data)
  if (!result.success) {
    throw new Error(`Redis configuration validation failed: ${JSON.stringify(result.error.format())}`)
  }
  return result.data
}