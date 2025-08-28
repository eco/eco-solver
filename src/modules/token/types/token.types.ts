/**
 * Supported chain identifier types across different blockchains
 * - number: EVM chain IDs (e.g., 1, 10, 137)
 * - string: SVM network identifiers (e.g., 'solana-mainnet') or TVM string IDs
 * - bigint: For large chain IDs that exceed JavaScript number limits
 */
export type ChainIdentifier = number | string | bigint;