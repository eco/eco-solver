import { registerAs } from '@nestjs/config';
import { z } from 'zod';

/**
 * Redis configuration schema
 */
export const RedisSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().int().positive().default(6379),
  password: z.string().optional(),
});

export type RedisConfig = z.infer<typeof RedisSchema>;

/**
 * Redis configuration factory using registerAs
 * Returns empty object - env vars handled in configurationFactory
 */
export const redisConfig = registerAs('redis', () => ({}));