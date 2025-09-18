import { z } from 'zod';

/**
 * Redis configuration schema
 */
export const RedisSchema = z.object({
  url: z.string().optional(),
  host: z.string().default('localhost'),
  port: z.coerce.number().int().positive().default(6379),
  username: z.string().optional(),
  password: z.string().optional(),
  tls: z.record(z.string()).optional(),
});

export type RedisConfig = z.infer<typeof RedisSchema>;
