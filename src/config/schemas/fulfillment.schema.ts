import { registerAs } from '@nestjs/config';
import { z } from 'zod';

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
 * Fulfillment configuration schema
 */
export const FulfillmentSchema = z.object({
  defaultStrategy: z
    .enum(['standard', 'crowd-liquidity', 'native-intents', 'negative-intents', 'rhinestone'])
    .default('standard'),
  strategies: FulfillmentStrategiesSchema.default({
    standard: { enabled: true },
    crowdLiquidity: { enabled: true },
    nativeIntents: { enabled: true },
    negativeIntents: { enabled: true },
    rhinestone: { enabled: true },
  }),
});

export type FulfillmentConfig = z.infer<typeof FulfillmentSchema>;
export type FulfillmentStrategyConfig = z.infer<typeof FulfillmentStrategySchema>;
export type FulfillmentStrategiesConfig = z.infer<typeof FulfillmentStrategiesSchema>;

/**
 * Fulfillment configuration factory using registerAs
 * Provides default values from Zod schema
 */
export const fulfillmentConfig = registerAs('fulfillment', () => {
  return FulfillmentSchema.parse({
    defaultStrategy: process.env.FULFILLMENT_DEFAULT_STRATEGY,
    strategies: {
      standard: {
        enabled: process.env.FULFILLMENT_STRATEGIES_STANDARD_ENABLED === 'false' ? false : undefined,
      },
      crowdLiquidity: {
        enabled: process.env.FULFILLMENT_STRATEGIES_CROWD_LIQUIDITY_ENABLED === 'false' ? false : undefined,
      },
      nativeIntents: {
        enabled: process.env.FULFILLMENT_STRATEGIES_NATIVE_INTENTS_ENABLED === 'false' ? false : undefined,
      },
      negativeIntents: {
        enabled: process.env.FULFILLMENT_STRATEGIES_NEGATIVE_INTENTS_ENABLED === 'false' ? false : undefined,
      },
      rhinestone: {
        enabled: process.env.FULFILLMENT_STRATEGIES_RHINESTONE_ENABLED === 'false' ? false : undefined,
      },
    },
  });
});