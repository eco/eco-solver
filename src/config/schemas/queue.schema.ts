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
    fulfillmentJobDelay: z.coerce.number().int().min(0).default(0),
    // Add execution-specific configuration
    execution: z
      .object({
        attempts: z.coerce.number().int().min(1).default(20),
        backoffDelay: z.coerce.number().int().min(100).default(5_000),
        backoffMaxDelay: z.coerce.number().int().min(1000).default(300_000), // 5 minutes
        backoffJitter: z.coerce.number().min(0).max(1).default(0.5), // 0-1 range for jitter factor
        useCustomBackoff: z.boolean().default(true), // Enable custom backoff strategy
      })
      .default({}),
  })
  .default({});

export type QueueConfig = z.infer<typeof QueueSchema>;
