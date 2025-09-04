import { z } from 'zod';

/**
 * Withdrawal configuration schema
 */
export const WithdrawalSchema = z
  .object({
    checkIntervalMinutes: z.coerce.number().int().positive().default(5),
  })
  .default({});

export type WithdrawalConfig = z.infer<typeof WithdrawalSchema>;
