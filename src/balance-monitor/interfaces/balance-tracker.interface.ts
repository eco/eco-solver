import { Hex } from 'viem'

/**
 * Represents a tracked balance for a specific token/native on a chain
 */
export interface TrackedBalance {
  /** The chain ID */
  chainId: number
  /** The token address (or 'native' for native gas tokens) */
  tokenAddress: string
  /** Current balance in smallest unit (wei for native, token units for ERC20) */
  balance: bigint
  /** Last updated timestamp */
  lastUpdated: Date
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
 * Redis keys for balance tracking data
 */
export interface BalanceTrackerRedisKeys {
  /** Key for storing tracked balance data */
  balance: (chainId: number, tokenAddress: string) => string
  /** Key for initialization lock */
  initLock: () => string
  /** Key for last initialization timestamp */
  lastInit: () => string
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
}
