import { z } from 'zod';

/**
 * Base environment configuration schema
 */
export const BaseSchema = z.object({
  env: z.enum(['development', 'test', 'production', 'preproduction']).default('development'),
  port: z.number().int().positive().default(3000),
  skipEcoPackageConfig: z.boolean().optional(),
  configFiles: z
    .union([z.string(), z.array(z.string())])
    .default('config.yaml')
    .describe('Path(s) to YAML configuration files'),
  apiKeys: z.array(z.string()).optional().describe('API keys for authentication'),
});

export type BaseConfig = z.infer<typeof BaseSchema>;
