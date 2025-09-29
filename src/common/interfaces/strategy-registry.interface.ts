import { Intent } from '@/common/interfaces/intent.interface';
import { IFulfillmentStrategy } from '@/modules/fulfillment/interfaces/fulfillment-strategy.interface';

export type WalletType = 'basic' | 'kernel';

/**
 * Strategy metadata for registration
 */
export interface StrategyMetadata {
  name: string;
  enabled: boolean;
  description?: string;
}

/**
 * Strategy registry interface for managing strategies
 * Follows Open/Closed Principle - extensible without modification
 */
export interface IStrategyRegistry {
  register(strategy: IFulfillmentStrategy, metadata: StrategyMetadata): void;

  unregister(strategyName: string): void;

  getStrategy(name: string): IFulfillmentStrategy | undefined;

  getStrategiesForIntent(intent: Intent): IFulfillmentStrategy[];

  getAllStrategies(): Map<string, IFulfillmentStrategy>;

  getDefaultStrategy(): IFulfillmentStrategy | undefined;

  isStrategyEnabled(name: string): boolean;
}
