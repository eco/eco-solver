import { z } from 'zod'

export const IntentConfigSchema = z.object({
  defaultFee: z.any(), // Complex fee structure
  proofs: z.any(), // Complex proof configuration
  intentFundedRetries: z.number().int().min(0).default(3),
  intentFundedRetryDelayMs: z.number().int().min(0).default(500),
  defaultGasOverhead: z.number().int().min(0).default(145000),
})

export type IntentConfig = z.infer<typeof IntentConfigSchema>

export const validateIntentConfig = (data: unknown): IntentConfig => {
  const result = IntentConfigSchema.safeParse(data)
  if (!result.success) {
    throw new Error(`Intent configuration validation failed: ${JSON.stringify(result.error.format())}`)
  }
  return result.data
}