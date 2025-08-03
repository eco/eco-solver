import { registerAs } from '@nestjs/config';
import { z } from 'zod';

/**
 * Queue configuration schema
 */
export const QueueSchema = z.object({
  concurrency: z.number().int().min(1).default(5),
  attempts: z.number().int().min(0).default(3),
  backoffType: z.string().default('exponential'),
  backoffDelay: z.number().int().min(0).default(5000),
  maxRetriesPerRequest: z.number().int().min(0).optional(),
  retryDelayMs: z.number().int().min(0).optional(),
});

export type QueueConfig = z.infer<typeof QueueSchema>;

/**
 * Queue configuration factory using registerAs
 * Provides default values from Zod schema
 */
export const queueConfig = registerAs('queue', () => {
  return QueueSchema.parse({
    concurrency: process.env.QUEUE_CONCURRENCY ? parseInt(process.env.QUEUE_CONCURRENCY, 10) : undefined,
    attempts: process.env.QUEUE_RETRY_ATTEMPTS ? parseInt(process.env.QUEUE_RETRY_ATTEMPTS, 10) : undefined,
    backoffType: process.env.QUEUE_BACKOFF_TYPE,
    backoffDelay: process.env.QUEUE_RETRY_DELAY ? parseInt(process.env.QUEUE_RETRY_DELAY, 10) : undefined,
    maxRetriesPerRequest: process.env.QUEUE_MAX_RETRIES_PER_REQUEST ? parseInt(process.env.QUEUE_MAX_RETRIES_PER_REQUEST, 10) : undefined,
    retryDelayMs: process.env.QUEUE_RETRY_DELAY_MS ? parseInt(process.env.QUEUE_RETRY_DELAY_MS, 10) : undefined,
  });
});