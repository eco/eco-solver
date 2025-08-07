import { z } from 'zod';

export const QuoteResponseSchema = z.object({
  valid: z.boolean(),
  strategy: z.string(),
  fees: z.object({
    baseFee: z.string(),
    percentageFee: z.string(),
    totalRequiredFee: z.string(),
    currentReward: z.string(),
    minimumRequiredReward: z.string(),
  }),
  validations: z.object({
    passed: z.array(z.string()),
    failed: z.array(
      z.object({
        validation: z.string(),
        reason: z.string(),
      }),
    ),
  }),
});

export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;