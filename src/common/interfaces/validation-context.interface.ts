import { Address } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';

/**
 * Base validation context with minimal required data
 * Interface Segregation Principle - clients only depend on what they need
 */
export interface IValidationContext {
  readonly intent: Intent;
}

/**
 * Context for validations that need strategy information
 */
export interface IStrategyValidationContext extends IValidationContext {
  readonly strategyName: string;
  canHandleIntent(): boolean;
}

/**
 * Context for validations that need blockchain reading capabilities
 */
export interface IBlockchainValidationContext extends IValidationContext {
  getBalance(address: Address, chainId: bigint): Promise<bigint>;
  getTokenBalance(tokenAddress: Address, walletAddress: Address, chainId: bigint): Promise<bigint>;
  isIntentFunded(intent: Intent): Promise<boolean>;
}

/**
 * Context for validations that need executor information
 */
export interface IExecutorValidationContext extends IValidationContext {
  getExecutorAddress(chainId: bigint): Promise<Address>;
  getExecutorBalance(chainId: bigint): Promise<bigint>;
}

/**
 * Full validation context for validations that need all capabilities
 */
export interface IFullValidationContext
  extends IStrategyValidationContext,
    IBlockchainValidationContext,
    IExecutorValidationContext {}
