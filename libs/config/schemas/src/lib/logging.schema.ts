import { z } from 'zod'

export const LoggingConfigSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
  usePino: z.boolean().default(true),
  pinoConfig: z
    .object({
      pinoHttp: z
        .object({
          level: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
          useLevelLabels: z.boolean().default(true),
          redact: z
            .object({
              paths: z.array(z.string()).default([]),
              remove: z.boolean().default(true),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
})

export type LoggingConfig = z.infer<typeof LoggingConfigSchema>

export const validateLoggingConfig = (data: unknown): LoggingConfig => {
  const result = LoggingConfigSchema.safeParse(data)
  if (!result.success) {
    throw new Error(
      `Logging configuration validation failed: ${JSON.stringify(result.error.format())}`,
    )
  }
  return result.data
}
