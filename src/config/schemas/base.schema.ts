import { z } from 'zod';

/**
 * Base environment configuration schema
 */
export const BaseSchema = z.object({
  env: z.string().default('development'),
  port: z.coerce.number().int().positive().default(3000),
  useEcoPackageConfig: z.boolean().optional(),
  configFiles: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe('Path(s) to YAML configuration files'),
});

export type BaseConfig = z.infer<typeof BaseSchema>;
