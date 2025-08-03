import { z } from 'zod';

/**
 * Base environment configuration schema
 */
export const BaseSchema = z.object({
  env: z.enum(['development', 'production', 'test']).default('development'),
  port: z.number().int().positive().default(3000),
});

export type BaseConfig = z.infer<typeof BaseSchema>;