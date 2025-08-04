import { registerAs } from '@nestjs/config';

import { z } from 'zod';

import { DeepPartial } from '@/common/types';

/**
 * Queue configuration schema
 */
export const QueueSchema = z.object({
  concurrency: z.number().int().min(1).default(5),
  executionConcurrency: z.number().int().min(1).default(10),
  attempts: z.number().int().min(0).default(3),
  backoffType: z.string().default('exponential'),
  backoffDelay: z.number().int().min(0).default(5000),
  maxRetriesPerRequest: z.number().int().min(0).optional(),
  retryDelayMs: z.number().int().min(0).optional(),
});

export type QueueConfig = z.infer<typeof QueueSchema>;

/**
 * Queue configuration factory using registerAs
 * Returns empty object - env vars handled in configurationFactory
 */
export const queueConfig = registerAs<DeepPartial<QueueConfig>>('queue', () => ({}));
