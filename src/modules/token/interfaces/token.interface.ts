import { UniversalAddress } from '@/common/types/universal-address.type';

/**
 * Token configuration interface that works across all blockchain types
 */
export interface TokenConfig {
  /** Token contract address */
  address: UniversalAddress;
  /** Number of decimals for the token */
  decimals: number;
  /** Token symbol (e.g., USDC, USDT, WETH) */
  symbol: string;
  /** Optional transfer limits */
  limit?: TokenLimit;
}

/**
 * Token transfer limit configuration
 */
export interface TokenLimit {
  /** Minimum transfer amount (in token units) */
  min?: number;
  /** Maximum transfer amount (in token units) */
  max?: number;
}
