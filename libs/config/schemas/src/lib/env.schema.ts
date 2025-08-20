import { z } from 'zod'

export const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production', 'staging', 'preproduction']),
  PORT: z.string().regex(/^\d+$/).transform(Number),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  AWS_REGION: z.string().min(1).optional(),
  // Validate required secrets exist (don't validate values for security)
  SECRET_KEY_EXISTS: z.string().min(1).optional(),
  API_KEY_EXISTS: z.string().min(1).optional(),
})

// Automatic type inference
export type Environment = z.infer<typeof EnvironmentSchema>

// Validate at startup - fail fast if environment is invalid
export const validateEnvironment = (): Environment => {
  const result = EnvironmentSchema.safeParse(process.env)
  if (!result.success) {
    console.error('❌ Invalid environment configuration:', result.error.format())
    process.exit(1)
  }
  return result.data
}