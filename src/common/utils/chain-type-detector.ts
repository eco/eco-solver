/**
 * Chain Type Detector Utility
 *
 * Determines the blockchain type (EVM, TVM, SVM) based on chain ID or network identifier.
 * Used for Portal contract encoding/decoding operations.
 */

export enum ChainType {
  EVM = 'evm',
  TVM = 'tvm', // Tron Virtual Machine
  SVM = 'svm', // Solana Virtual Machine
}

/**
 * Chain ID ranges and specific identifiers for different blockchain types
 */
const CHAIN_TYPE_MAPPINGS = {
  // TVM chain IDs (Tron-specific)
  TVM_CHAIN_IDS: [
    728126428, // Tron mainnet
    2494104990, // Tron Shasta testnet
    // Add more TVM chain IDs as needed
  ],

  // SVM network identifiers (string-based)
  SVM_NETWORKS: ['solana-mainnet', 'solana-devnet', 'solana-testnet'],

  // Mapping from numeric chain IDs to SVM network identifiers
  SVM_CHAIN_ID_MAPPING: {
    1399811149: 'solana-mainnet', // Solana mainnet numeric chain ID
    // Add more SVM numeric chain ID mappings as needed
  } as Record<number, string>,
};

export class ChainTypeDetector {
  /**
   * Detects chain type from chain ID or network identifier
   *
   * @param chainIdentifier - Chain ID (number/bigint) or network string
   * @returns ChainType enum value
   * @throws Error if chain type cannot be determined
   */
  static detect(chainIdentifier: bigint | number | string): ChainType {
    // Handle string identifiers (SVM networks)
    if (typeof chainIdentifier === 'string') {
      if (CHAIN_TYPE_MAPPINGS.SVM_NETWORKS.includes(chainIdentifier)) {
        return ChainType.SVM;
      }
      throw new Error(`Unknown string chain identifier: ${chainIdentifier}`);
    }

    // Convert bigint to number for comparison
    const chainId = typeof chainIdentifier === 'bigint' ? Number(chainIdentifier) : chainIdentifier;

    // Check TVM chains
    if (CHAIN_TYPE_MAPPINGS.TVM_CHAIN_IDS.includes(chainId)) {
      return ChainType.TVM;
    }

    // Check SVM numeric chain ID mapping
    if (CHAIN_TYPE_MAPPINGS.SVM_CHAIN_ID_MAPPING[chainId]) {
      return ChainType.SVM;
    }

    // Default heuristics for unknown chains
    if (this.isLikelyEvmChainId(chainId)) {
      return ChainType.EVM;
    }

    throw new Error(`Cannot determine chain type for chain ID: ${chainId}`);
  }

  /**
   * Gets the string network identifier for a numeric SVM chain ID
   *
   * @param chainId - Numeric chain ID
   * @returns String network identifier (e.g., 'solana-mainnet') or undefined if not found
   */
  static getNetworkIdentifier(chainId: number | bigint): string | number | bigint {
    const numericChainId = typeof chainId === 'bigint' ? Number(chainId) : chainId;
    if (CHAIN_TYPE_MAPPINGS.SVM_CHAIN_ID_MAPPING[numericChainId]) {
      return CHAIN_TYPE_MAPPINGS.SVM_CHAIN_ID_MAPPING[numericChainId];
    }
    return chainId;
  }

  /**
   * Gets the native address format for a chain type
   *
   * @param chainType - The chain type
   * @returns Address format description
   */
  static getAddressFormat(chainType: ChainType): string {
    switch (chainType) {
      case ChainType.EVM:
        return 'hex (0x prefixed, 20 bytes)';
      case ChainType.TVM:
        return 'base58 (Tron format)';
      case ChainType.SVM:
        return 'base58 (Solana format, 32 bytes)';
      default:
        throw new Error(`Unknown chain type: ${chainType}`);
    }
  }

  /**
   * Validates if an address format matches the expected chain type
   *
   * @param address - Address string to validate
   * @param chainType - Expected chain type
   * @returns true if address format matches chain type
   */
  static isValidAddressForChain(address: string, chainType: ChainType): boolean {
    switch (chainType) {
      case ChainType.EVM:
        return /^0x[a-fA-F0-9]{40}$/.test(address);
      case ChainType.TVM:
        // Tron addresses start with T and are 34 characters long
        return /^T[A-Za-z0-9]{33}$/.test(address);
      case ChainType.SVM:
        // Solana addresses are base58 encoded, typically 32-44 characters
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      default:
        return false;
    }
  }

  /**
   * Checks if a chain ID follows EVM conventions
   * EVM chain IDs are typically positive integers within reasonable ranges
   *
   * @param chainId - Numeric chain ID
   * @returns true if likely an EVM chain
   */
  private static isLikelyEvmChainId(chainId: number): boolean {
    // EVM chain IDs are typically:
    // - Positive integers
    // - Less than 2^32 (4,294,967,296)
    // - Not in the TVM reserved range
    // - Not in the SVM reserved range
    return (
      Number.isInteger(chainId) &&
      chainId > 0 &&
      chainId < 4_294_967_296 &&
      !CHAIN_TYPE_MAPPINGS.TVM_CHAIN_IDS.includes(chainId) &&
      !CHAIN_TYPE_MAPPINGS.SVM_CHAIN_ID_MAPPING[chainId] // Use the new mapping here
    );
  }
}
