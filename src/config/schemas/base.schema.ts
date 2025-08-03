import { registerAs } from '@nestjs/config';
import { z } from 'zod';

import { DeepPartial } from '@/common/types';

/**
 * Base environment configuration schema
 */
export const BaseSchema = z.object({
  env: z.enum(['development', 'production', 'test']).default('development'),
  port: z.number().int().positive().default(3000),
});

export type BaseConfig = z.infer<typeof BaseSchema>;

/**
 * Base configuration factory using registerAs
 * Returns empty object - env vars handled in configurationFactory
 */
export const baseConfig = registerAs<DeepPartial<BaseConfig>>('base', () => ({}));