import { z } from 'zod';

import { AssetsFeeSchema, RouteFeeOverrideSchema } from '@/config/schemas/fee.schema';
import { RouteAmountLimitSchema } from '@/config/schemas/route-limit.schema';
import { FULFILLMENT_STRATEGY_NAMES } from '@/modules/fulfillment/types/strategy-name.type';

/**
 * Route enablement configuration schema
 */
const RouteEnablementSchema = z
  .object({
    mode: z.enum(['whitelist', 'blacklist']),
    routes: z.array(z.string()),
  })
  .optional();

/**
 * Fulfillment strategy configuration schema
 */
const FulfillmentStrategySchema = z.object({
  enabled: z.boolean().default(true),
  routeEnablement: RouteEnablementSchema,
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
const ValidationsSchema = z.object({
  routeEnablement: RouteEnablementSchema,
});

/**
 * Fulfillment configuration schema
 */
export const FulfillmentSchema = z.object({
  deadlineDuration: z.coerce.number().int().positive().default(7_200),
  defaultStrategy: z
    .enum([
      FULFILLMENT_STRATEGY_NAMES.STANDARD,
      FULFILLMENT_STRATEGY_NAMES.CROWD_LIQUIDITY,
      FULFILLMENT_STRATEGY_NAMES.NATIVE_INTENTS,
      FULFILLMENT_STRATEGY_NAMES.NEGATIVE_INTENTS,
      FULFILLMENT_STRATEGY_NAMES.RHINESTONE,
    ])
    .default(FULFILLMENT_STRATEGY_NAMES.STANDARD),
  strategies: FulfillmentStrategiesSchema.default({
    standard: { enabled: true },
    crowdLiquidity: { enabled: false },
    nativeIntents: { enabled: false },
    negativeIntents: { enabled: false },
    rhinestone: { enabled: false },
  }),
  validations: ValidationsSchema.default({}),
  defaultFee: AssetsFeeSchema, // Global default fee configuration (lowest priority)
  routeFeeOverrides: z.array(RouteFeeOverrideSchema).optional(),
  // Global default route amount limit (fallback when token has no specific limit)
  defaultRouteLimit: RouteAmountLimitSchema.optional(),
});

export type FulfillmentConfig = z.infer<typeof FulfillmentSchema>;
