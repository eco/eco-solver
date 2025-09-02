import { z } from 'zod';

import {
  AwsSchema,
  BaseSchema,
  DataDogSchema,
  EvmSchema,
  FulfillmentSchema,
  MongoDBSchema,
  OpenTelemetrySchema,
  QueueSchema,
  RedisSchema,
  SolanaSchema,
  TvmSchema,
  WithdrawalSchema,
} from '@/config/schemas';

// Re-export individual schemas for use in config services
export {
  AwsSchema,
  BaseSchema,
  DataDogSchema,
  EvmSchema,
  FulfillmentSchema,
  MongoDBSchema,
  OpenTelemetrySchema,
  QueueSchema,
  RedisSchema,
  SolanaSchema,
  TvmSchema,
  WithdrawalSchema,
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
    tvm: TvmSchema,
    queue: QueueSchema,
    aws: AwsSchema,
    fulfillment: FulfillmentSchema,
    datadog: DataDogSchema,
    opentelemetry: OpenTelemetrySchema,
    withdrawal: WithdrawalSchema,
  })
  .extend(BaseSchema.shape);

// Export the inferred TypeScript type
export type Config = z.infer<typeof ConfigSchema>;
