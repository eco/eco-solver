import { registerAs } from '@nestjs/config';

import { z } from 'zod';

import { DeepPartial } from '@/common/types';
import { FULFILLMENT_STRATEGY_NAMES } from '@/modules/fulfillment/types/strategy-name.type';

/**
 * Fulfillment strategy configuration schema
 */
const FulfillmentStrategySchema = z.object({
  enabled: z.boolean().default(true),
});

/**
 * Fulfillment strategies configuration schema
 */
const FulfillmentStrategiesSchema = z.object({
  standard: FulfillmentStrategySchema,
  crowdLiquidity: FulfillmentStrategySchema,
  nativeIntents: FulfillmentStrategySchema,
  negativeIntents: FulfillmentStrategySchema,
  rhinestone: FulfillmentStrategySchema,
});

/**
 * Validations configuration schema
 */
const ValidationsSchema = z.object({});

/**
 * Fulfillment configuration schema
 */
export const FulfillmentSchema = z.object({
  deadlineDuration: z.number().int().positive().default(7_200),
  defaultStrategy: z
    .enum([
      FULFILLMENT_STRATEGY_NAMES.STANDARD,
      FULFILLMENT_STRATEGY_NAMES.CROWD_LIQUIDITY,
      FULFILLMENT_STRATEGY_NAMES.NATIVE_INTENTS,
      FULFILLMENT_STRATEGY_NAMES.NEGATIVE_INTENTS,
      FULFILLMENT_STRATEGY_NAMES.RHINESTONE,
    ])
    .default(FULFILLMENT_STRATEGY_NAMES.STANDARD),
  validations: ValidationsSchema.default({}),
});

export type FulfillmentConfig = z.infer<typeof FulfillmentSchema>;
export type FulfillmentStrategyConfig = z.infer<typeof FulfillmentStrategySchema>;
export type FulfillmentStrategiesConfig = z.infer<typeof FulfillmentStrategiesSchema>;
export type ValidationsConfig = z.infer<typeof ValidationsSchema>;

/**
 * Fulfillment configuration factory using registerAs
 * Returns empty object - env vars handled in configurationFactory
 */
export const fulfillmentConfig = registerAs<DeepPartial<FulfillmentConfig>>(
  'fulfillment',
  () => ({}),
);
