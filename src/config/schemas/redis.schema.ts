import { z } from 'zod';

/**
 * Cluster node schema for Redis cluster configuration
 */
const ClusterNodeSchema = z.object({
  host: z.string(),
  port: z.coerce.number().int().positive(),
});

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
  enableCluster: z.boolean().default(false),
  clusterNodes: z.array(ClusterNodeSchema).optional(),
  clusterOptions: z
    .object({
      retryDelayOnClusterDown: z.number().optional(),
      retryDelayOnFailover: z.number().optional(),
      retryDelayOnTryAgain: z.number().optional(),
      slotsRefreshTimeout: z.number().optional(),
      slotsRefreshInterval: z.number().optional(),
      enableReadyCheck: z.boolean().optional(),
      maxRetriesPerRequest: z.number().nullable().optional(),
      enableOfflineQueue: z.boolean().optional(),
    })
    .optional(),
});

export type RedisConfig = z.infer<typeof RedisSchema>;
