import { Hex } from 'viem'

/**
 * Represents a tracked balance for a specific token/native on a chain
 * This interface matches the MongoDB schema
 */
export interface TrackedBalance {
  /** The chain ID */
  chainId: number
  /** The token address (or 'native' for native gas tokens) */
  tokenAddress: string
  /** Current balance as string (to handle BigInt storage) */
  balance: string
  /** Token decimals (for ERC20 tokens) */
  decimals?: number
  /** Block number (for native tokens) */
  blockNumber?: string
  /** Last updated timestamp */
  lastUpdated: Date
  /** Transaction hash that last updated this balance */
  transactionHash?: string
}

/**
 * Balance change data for tracking increments/decrements
 */
export interface BalanceChange {
  /** The chain ID where the balance changed */
  chainId: number
  /** The token address that changed */
  tokenAddress: string
  /** Change amount (positive for increment, negative for decrement) */
  changeAmount: bigint
  /** Transaction hash that caused the change (if applicable) */
  transactionHash?: Hex
  /** Timestamp of the change */
  timestamp?: Date
}

/**
 * Balance initialization data from the balance service
 */
export interface BalanceInitData {
  /** Chain ID */
  chainId: number
  /** Token address or 'native' */
  tokenAddress: string
  /** Initial balance */
  balance: bigint
  /** Token decimals (for ERC20 tokens) */
  decimals?: number
  /** Block number (for native tokens) */
  blockNumber?: bigint
}
