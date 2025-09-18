import { TProverType } from '@/common/interfaces/prover.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AssetsFeeSchemaType } from '@/config/schemas/fee.schema';
import { ChainIdentifier } from '@/modules/token/types/token.types';

/**
 * Token configuration interface
 * Represents the configuration for a supported token on a blockchain
 */
export interface TokenConfig {
  /** Token contract address */
  address: UniversalAddress;
  /** Number of decimal places for the token */
  decimals: number;
  /** Token symbol (e.g., 'USDC', 'ETH') */
  symbol: string;
  /** Optional transaction amount limits */
  limit?: number | { min?: number; max?: number };
  /** Optional token-specific fee configuration */
  fee?: AssetsFeeSchemaType;
}

/**
 * Common interface for all blockchain configuration services
 * Provides a unified API for accessing chain-specific configurations
 */
export interface IBlockchainConfigService {
  /**
   * Checks if the blockchain is properly configured
   */
  isConfigured(): boolean;

  /**
   * Gets the list of supported chain IDs
   */
  getSupportedChainIds(): (number | string)[];

  /**
   * Gets the Portal contract address for the chain
   * @param chainId Chain identifier
   */
  getPortalAddress(chainId: ChainIdentifier): UniversalAddress;

  /**
   * Gets the list of supported tokens for the chain
   * @param chainId Chain identifier
   */
  getSupportedTokens(chainId: ChainIdentifier): TokenConfig[];

  /**
   * Checks if a token is supported on the chain
   * @param chainId Chain identifier
   * @param tokenAddress Token address
   */
  isTokenSupported(chainId: ChainIdentifier, tokenAddress: UniversalAddress): boolean;

  /**
   * Gets the configuration for a specific token
   * @param chainId Chain identifier
   * @param tokenAddress Token address
   */
  getTokenConfig(chainId: ChainIdentifier, tokenAddress: UniversalAddress): TokenConfig;

  /**
   * Gets the fee configuration for the chain
   * @param chainId Chain identifier
   */
  getFeeLogic(chainId: ChainIdentifier): AssetsFeeSchemaType;

  /**
   * Gets the prover contract address for the chain
   * @param chainId Chain identifier
   * @param proverType Prover type ('hyper' or 'metalayer')
   */
  getProverAddress(chainId: ChainIdentifier, proverType: TProverType): UniversalAddress | undefined;

  /**
   * Gets the claimant address for the chain
   * @param chainId Chain identifier
   */
  getClaimant(chainId: ChainIdentifier): UniversalAddress;

  /**
   * Gets the default prover type for the chain
   * @param chainId Chain identifier
   */
  getDefaultProver(chainId: ChainIdentifier): TProverType;
}
