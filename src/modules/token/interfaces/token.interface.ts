/**
 * Token configuration interface that works across all blockchain types
 */
export interface TokenConfig {
  /** Token contract address (format depends on chain type) */
  address: string;
  /** Number of decimals for the token */
  decimals: number;
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

/**
 * Chain-specific token configuration
 */
export interface ChainTokenConfig {
  /** Chain identifier (can be number, string, or bigint) */
  chainId: number | string | bigint;
  /** List of supported tokens on this chain */
  tokens: TokenConfig[];
}
