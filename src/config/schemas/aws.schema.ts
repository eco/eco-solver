import { z } from 'zod';

/**
 * AWS configuration schema
 */
export const AwsSchema = z.object({
  region: z.string().optional(),
  secretName: z.string().optional(),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
});

export type AwsConfig = z.infer<typeof AwsSchema>;
