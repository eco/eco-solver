import { z } from 'zod';

/**
 * Leader Election configuration schema
 */
export const LeaderElectionSchema = z.object({
  enabled: z.coerce.boolean().default(false),
  lockKey: z.string().default('solver:leader:lock'),
  lockTtlSeconds: z.coerce.number().int().positive().default(30),
  heartbeatIntervalMs: z.coerce.number().int().positive().default(10000),
  electionCheckIntervalMs: z.coerce.number().int().positive().default(5000),
});

export type LeaderElectionConfig = z.infer<typeof LeaderElectionSchema>;
