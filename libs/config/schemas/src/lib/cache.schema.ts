import { z } from 'zod'

export const CacheConfigSchema = z.object({
  ttl: z.number().positive().default(300000), // 5 minutes default
  max: z.number().positive().default(100), // Max items in cache
})

// Automatic type inference
export type CacheConfig = z.infer<typeof CacheConfigSchema>

export const validateCacheConfig = (data: unknown): CacheConfig => {
  const result = CacheConfigSchema.safeParse(data)
  if (!result.success) {
    throw new Error(`Cache configuration validation failed: ${JSON.stringify(result.error.format())}`)
  }
  return result.data
}