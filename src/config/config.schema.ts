import { z } from 'zod';

import {
  AwsSchema,
  BaseSchema,
  BullBoardSchema,
  EvmSchema,
  FulfillmentSchema,
  LeaderElectionSchema,
  MongoDBSchema,
  OpenTelemetrySchema,
  ProversSchema,
  QueueSchema,
  QuotesSchema,
  RedisSchema,
  RhinestoneSchema,
  SolanaSchema,
  TvmSchema,
  WithdrawalSchema,
} from '@/config/schemas';

// Re-export individual schemas for use in config services
export {
  AwsSchema,
  BaseSchema,
  BullBoardSchema,
  EvmSchema,
  FulfillmentSchema,
  LeaderElectionSchema,
  MongoDBSchema,
  OpenTelemetrySchema,
  ProversSchema,
  QueueSchema,
  QuotesSchema,
  RedisSchema,
  RhinestoneSchema,
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
    svm: SolanaSchema.optional(),
    tvm: TvmSchema.optional(),
    provers: ProversSchema,
    queue: QueueSchema,
    aws: AwsSchema.optional(),
    fulfillment: FulfillmentSchema,
    rhinestone: RhinestoneSchema.optional(),
    opentelemetry: OpenTelemetrySchema,
    withdrawal: WithdrawalSchema,
    bullBoard: BullBoardSchema.optional(),
    quotes: QuotesSchema.optional(),
    leaderElection: LeaderElectionSchema.optional(),
  })
  .extend(BaseSchema.shape);

// Export the inferred TypeScript type
export type Config = z.infer<typeof ConfigSchema>;
