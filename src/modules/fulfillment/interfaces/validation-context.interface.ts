import { Address } from 'viem';

/**
 * Context provided to validations for accessing necessary blockchain information
 * without exposing the entire fulfillment strategy
 */
export interface ValidationContext {
  /**
   * Get the wallet address that will be used for execution on a specific chain
   * @param chainId The chain ID to get the wallet address for
   * @returns The wallet address
   */
  getWalletAddress(chainId: bigint): Promise<Address>;

  /**
   * Get the balance of the execution wallet on a specific chain
   * @param chainId The chain ID to check balance on
   * @param tokenAddress Optional token address (if not provided, returns native balance)
   * @returns The balance in the smallest unit
   */
  getWalletBalance(chainId: bigint, tokenAddress?: Address): Promise<bigint>;

  /**
   * Get the wallet type/ID that will be used for this execution
   * @returns The wallet identifier (e.g., 'basic', 'kernel')
   */
  getWalletId(): Promise<string>;
}