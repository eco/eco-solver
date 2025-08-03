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
 * Provides default values from Zod schema
 */
export const redisConfig = registerAs('redis', () => {
  return RedisSchema.parse({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined,
    password: process.env.REDIS_PASSWORD,
  });
});