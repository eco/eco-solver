import { registerAs } from '@nestjs/config';
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

/**
 * AWS configuration factory using registerAs
 * Provides default values from Zod schema
 */
export const awsConfig = registerAs('aws', () => {
  return AwsSchema.parse({
    region: process.env.AWS_REGION,
    secretName: process.env.AWS_SECRET_NAME,
    useAwsSecrets: process.env.USE_AWS_SECRETS === 'true',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });
});