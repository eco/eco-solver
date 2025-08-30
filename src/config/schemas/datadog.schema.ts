import { z } from 'zod';

/**
 * DataDog configuration schema
 */
export const DataDogSchema = z.object({
  enabled: z.boolean().default(false).describe('Whether DataDog metrics are enabled'),
  host: z.string().default('localhost').describe('DataDog StatsD agent host'),
  port: z.number().int().positive().default(8125).describe('DataDog StatsD agent port'),
  prefix: z.string().default('blockchain_intent_solver.').describe('Metric name prefix'),
  globalTags: z
    .object({
      env: z.string().optional(),
      service: z.string().default('blockchain-intent-solver'),
    })
    .optional()
    .describe('Global tags to apply to all metrics'),
});

export type DataDogConfig = z.infer<typeof DataDogSchema>;
