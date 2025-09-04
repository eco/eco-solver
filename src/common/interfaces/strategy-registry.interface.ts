import { Intent } from '@/common/interfaces/intent.interface';
import { QuoteResult } from '@/modules/fulfillment/interfaces/quote-result.interface';

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
 * Core fulfillment strategy interface
 * Defines the contract that all strategies must implement
 */
export interface IFulfillmentStrategy {
  readonly name: string;

  validate(intent: Intent): Promise<boolean>;

  execute(intent: Intent): Promise<void>;

  canHandle(intent: Intent): boolean;

  getQuote(intent: Intent): Promise<QuoteResult>;

  getWalletIdForIntent(intent: Intent): Promise<WalletType>;
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
