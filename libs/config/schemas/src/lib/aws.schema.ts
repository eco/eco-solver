import { z } from 'zod'

export const AwsConfigSchema = z.object({
  region: z.string().min(1),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  secretsManager: z
    .object({
      enabled: z.boolean().default(false),
      secrets: z.array(z.string()).default([]),
    })
    .optional(),
})

// Automatic type inference
export type AwsConfig = z.infer<typeof AwsConfigSchema>

export const validateAwsConfig = (data: unknown): AwsConfig => {
  const result = AwsConfigSchema.safeParse(data)
  if (!result.success) {
    throw new Error(`AWS configuration validation failed: ${JSON.stringify(result.error.format())}`)
  }
  return result.data
}
