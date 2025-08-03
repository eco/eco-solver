export const FULFILLMENT_STRATEGY_NAMES = {
  STANDARD: 'standard',
  CROWD_LIQUIDITY: 'crowd-liquidity',
  NATIVE_INTENTS: 'native-intents',
  NEGATIVE_INTENTS: 'negative-intents',
  RHINESTONE: 'rhinestone',
} as const;

export type FulfillmentStrategyName =
  (typeof FULFILLMENT_STRATEGY_NAMES)[keyof typeof FULFILLMENT_STRATEGY_NAMES];
