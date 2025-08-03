import { z } from 'zod';

/**
 * MongoDB configuration schema
 */
export const MongoDBSchema = z.object({
  uri: z
    .string()
    .url()
    .or(z.string().regex(/^mongodb:/)),
});

export type MongoDBConfig = z.infer<typeof MongoDBSchema>;