import { registerAs } from '@nestjs/config';
import { z } from 'zod';

/**
 * MongoDB configuration schema
 */
export const MongoDBSchema = z.object({
  uri: z
    .string()
    .url()
    .or(z.string().regex(/^mongodb:/))
    .default('mongodb://localhost:27017/intent-solver'),
});

export type MongoDBConfig = z.infer<typeof MongoDBSchema>;

/**
 * MongoDB configuration factory using registerAs
 * Returns empty object - env vars handled in configurationFactory
 */
export const mongodbConfig = registerAs('mongodb', () => ({}));