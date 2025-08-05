import { registerAs } from '@nestjs/config';

import { z } from 'zod';

import { DeepPartial } from '@/common/types';

/**
 * AWS configuration schema
 */
export const AwsSchema = z
  .object({
    region: z.string(),
    secretName: z.string(),
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
  })
  .optional();

export type AwsConfig = z.infer<typeof AwsSchema>;

/**
 * AWS configuration factory using registerAs
 * Returns empty object - env vars handled in configurationFactory
 */
export const awsConfig = registerAs<DeepPartial<AwsConfig>>('aws', () => undefined);
