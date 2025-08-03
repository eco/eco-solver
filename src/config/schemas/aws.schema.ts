import { z } from 'zod';

/**
 * AWS configuration schema
 */
export const AwsSchema = z.object({
  region: z.string().default('us-east-1'),
  secretName: z.string().default('blockchain-intent-solver-secrets'),
  useAwsSecrets: z.boolean().default(false),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
});

export type AwsConfig = z.infer<typeof AwsSchema>;