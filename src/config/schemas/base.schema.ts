import { registerAs } from '@nestjs/config';
import { z } from 'zod';

/**
 * Base environment configuration schema
 */
export const BaseSchema = z.object({
  env: z.enum(['development', 'production', 'test']).default('development'),
  port: z.number().int().positive().default(3000),
});

export type BaseConfig = z.infer<typeof BaseSchema>;

/**
 * Base configuration factory using registerAs
 * Provides default values from Zod schema
 */
export const baseConfig = registerAs('base', () => {
  return BaseSchema.parse({
    env: process.env.NODE_ENV,
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
  });
});