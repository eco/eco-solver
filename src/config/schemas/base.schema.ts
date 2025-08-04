import { registerAs } from '@nestjs/config';

import { z } from 'zod';

import { DeepPartial } from '@/common/types';

/**
 * Base environment configuration schema
 */
export const BaseSchema = z.object({
  env: z.enum(['development', 'production', 'preproduction']).default('development'),
  port: z.number().int().positive().default(3000),
  skipEcoPackageConfig: z.boolean().optional(),
  configFiles: z
    .union([z.string(), z.array(z.string())])
    .default('config.yaml')
    .describe('Path(s) to YAML configuration files'),
});

export type BaseConfig = z.infer<typeof BaseSchema>;

/**
 * Base configuration factory using registerAs
 * Returns empty object - env vars handled in configurationFactory
 */
export const baseConfig = registerAs<DeepPartial<BaseConfig>>('base', () => ({}));
