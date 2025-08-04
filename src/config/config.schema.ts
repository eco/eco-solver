import { z } from 'zod';

import {
  AwsSchema,
  BaseSchema,
  EvmSchema,
  FulfillmentSchema,
  MongoDBSchema,
  QueueSchema,
  RedisSchema,
  SolanaSchema,
} from '@/config/schemas';

// Re-export individual schemas for use in config services
export {
  AwsSchema,
  BaseSchema,
  EvmSchema,
  FulfillmentSchema,
  MongoDBSchema,
  QueueSchema,
  RedisSchema,
  SolanaSchema,
} from '@/config/schemas';

/**
 * Zod schema for the application configuration
 * This schema defines the structure, types, and validation rules for all configuration
 */
export const ConfigSchema = z
  .object({
    mongodb: MongoDBSchema,
    redis: RedisSchema,
    evm: EvmSchema,
    solana: SolanaSchema,
    queue: QueueSchema,
    aws: AwsSchema,
    fulfillment: FulfillmentSchema,
  })
  .extend(BaseSchema.shape);

// Export the inferred TypeScript type
export type Config = z.infer<typeof ConfigSchema>;
