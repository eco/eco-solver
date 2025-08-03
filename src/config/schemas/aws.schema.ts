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
 * Returns empty object - env vars handled in configurationFactory
 */
export const awsConfig = registerAs('aws', () => ({}));