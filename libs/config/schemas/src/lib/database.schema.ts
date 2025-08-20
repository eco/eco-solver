import { z } from 'zod'

export const DatabaseConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  ssl: z.boolean().default(true),
  pool: z.object({
    min: z.number().int().nonnegative().default(2),
    max: z.number().int().positive().default(10),
  }),
})

// Automatic type inference - no manual interfaces!
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>

export const validateDatabaseConfig = (data: unknown): DatabaseConfig => {
  const result = DatabaseConfigSchema.safeParse(data)
  if (!result.success) {
    throw new Error(`Database configuration validation failed: ${JSON.stringify(result.error.format())}`)
  }
  return result.data
}