import { z } from 'zod'

export const ServerConfigSchema = z.object({
  url: z.string().url(),
  port: z.number().int().min(1000).max(65535),
  host: z.string().default('localhost'),
  enableHttps: z.boolean().default(false),
  requestTimeout: z.number().positive().default(30000),
})

// Automatic type inference - no manual interface needed!
export type ServerConfig = z.infer<typeof ServerConfigSchema>

// Validation at load time with helpful error messages
export class ConfigurationValidationError extends Error {
  constructor(message: string, public validationErrors: any) {
    super(message)
    this.name = 'ConfigurationValidationError'
  }
}

export const validateServerConfig = (data: unknown): ServerConfig => {
  const result = ServerConfigSchema.safeParse(data)
  if (!result.success) {
    throw new ConfigurationValidationError(
      'Server configuration validation failed',
      result.error.format(),
    )
  }
  return result.data
}
