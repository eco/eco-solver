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
 * Route limits validation configuration schema
 */
const RouteAmountLimitsSchema = z.object({
  default: z
    .string()
    .default('10000000000000000000') // 10 ETH in wei
    .transform((val) => BigInt(val)),
  routes: z
    .array(
      z.object({
        chainId: z.string().transform((val) => BigInt(val)),
        limit: z.string().transform((val) => BigInt(val)),
      }),
    )
    .default([]),
});

/**
 * Native fee validation configuration schema
 */
const NativeFeeSchema = z.object({
  baseFee: z.string().transform((val) => BigInt(val)), // ETH in wei
  bpsFee: z.number(), // bps
});

/**
 * Crowd liquidity fee validation configuration schema
 */
const CrowdLiquidityFeeSchema = z.object({
  baseFee: z
    .string()
    .default('500000') // 0.0005 ETH in gwei
    .transform((val) => BigInt(val)),
  bpsFee: z
    .string()
    .default('50') // 0.5% as basis points
    .transform((val) => BigInt(val)),
});

/**
 * Validations configuration schema
 */
const ValidationsSchema = z.object({
  routeLimits: RouteAmountLimitsSchema.default({}),
  nativeFee: NativeFeeSchema.default({}),
  crowdLiquidityFee: CrowdLiquidityFeeSchema.default({}),
});

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
export type RouteAmountLimitsConfig = z.infer<typeof RouteAmountLimitsSchema>;
export type NativeFeeConfig = z.infer<typeof NativeFeeSchema>;
export type CrowdLiquidityFeeConfig = z.infer<typeof CrowdLiquidityFeeSchema>;
export type ValidationsConfig = z.infer<typeof ValidationsSchema>;

/**
 * Fulfillment configuration factory using registerAs
 * Returns empty object - env vars handled in configurationFactory
 */
export const fulfillmentConfig = registerAs<DeepPartial<FulfillmentConfig>>(
  'fulfillment',
  () => ({}),
);
