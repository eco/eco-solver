import { z } from 'zod';

/**
 * Queue configuration schema
 */
export const QueueSchema = z
  .object({
    concurrency: z.coerce.number().int().min(1).default(5),
    executionConcurrency: z.coerce.number().int().min(1).default(10),
    attempts: z.coerce.number().int().min(0).default(3),
    backoffType: z.string().default('exponential'),
    backoffDelay: z.coerce.number().int().min(0).default(5000),
    maxRetriesPerRequest: z.coerce.number().int().min(0).optional(),
    retryDelayMs: z.coerce.number().int().min(0).optional(),
    retry: z
      .object({
        temporary: z
          .object({
            attempts: z.coerce.number().int().min(1).default(5),
            backoffMs: z.coerce.number().int().min(1000).default(2000),
          })
          .default({}),
      })
      .default({}),
  })
  .default({});

export type QueueConfig = z.infer<typeof QueueSchema>;
