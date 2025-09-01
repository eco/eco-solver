import { Injectable } from '@nestjs/common';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType, ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { EvmTokenConfig, TvmTokenConfig } from '@/config/schemas';
import { EvmConfigService } from '@/modules/config/services/evm-config.service';
import { SolanaConfigService } from '@/modules/config/services/solana-config.service';
import { TvmConfigService } from '@/modules/config/services/tvm-config.service';
import { TokenConfig } from '@/modules/token/interfaces/token.interface';
import { ChainIdentifier } from '@/modules/token/types/token.types';

/**
 * Chain-agnostic token configuration service
 * Provides a unified interface for token operations across all supported blockchain types
 */
@Injectable()
export class TokenConfigService {
  constructor(
    private readonly evmConfig: EvmConfigService,
    private readonly tvmConfig: TvmConfigService,
    private readonly solanaConfig: SolanaConfigService,
  ) {}

  /**
   * Checks if a token is supported on a specific chain
   * @param chainId - Chain identifier (number, string, or bigint)
   * @param tokenAddress - Token contract address
   * @returns true if token is supported, false otherwise
   */
  isTokenSupported(chainId: ChainIdentifier, tokenAddress: UniversalAddress): boolean {
    try {
      const chainType = ChainTypeDetector.detect(chainId);

      switch (chainType) {
        case ChainType.EVM:
          return this.evmConfig.isTokenSupported(Number(chainId), tokenAddress);
        case ChainType.TVM:
          return this.tvmConfig.isTokenSupported(chainId, tokenAddress);
        case ChainType.SVM:
          // For Solana, we don't have token restrictions in the current config
          // This can be extended when Solana token configuration is added
          return true;
        default:
          return false;
      }
    } catch (error) {
      // If chain type cannot be detected or config service throws, token is not supported
      return false;
    }
  }

  /**
   * Gets token configuration for a specific token on a chain
   * @param chainId - Chain identifier
   * @param tokenAddress - Token contract address
   * @returns TokenConfig object
   * @throws Error if token is not found or chain is not supported
   */
  getTokenConfig(chainId: ChainIdentifier, tokenAddress: UniversalAddress): TokenConfig {
    try {
      const chainType = ChainTypeDetector.detect(chainId);

      switch (chainType) {
        case ChainType.EVM: {
          const evmToken = this.evmConfig.getTokenConfig(Number(chainId), tokenAddress);
          return this.mapEvmTokenConfig(evmToken);
        }
        case ChainType.TVM: {
          const tvmToken = this.tvmConfig.getTokenConfig(chainId, tokenAddress);
          return this.mapTvmTokenConfig(tvmToken);
        }
        case ChainType.SVM:
          // For Solana, return a default configuration
          // This can be extended when Solana token configuration is added
          return {
            address: tokenAddress,
            decimals: 9, // Default for SPL tokens
          };
        default:
          throw new Error(`Unsupported chain type for chain ID: ${chainId}`);
      }
    } catch (error: any) {
      // Re-throw with a more specific error message if it's not a chain config error
      if (error.message?.includes('Cannot determine chain type')) {
        throw new Error(`Unsupported chain type for chain ID: ${chainId}`);
      }
      // Otherwise just re-throw the original error (e.g., from config services)
      throw error;
    }
  }

  /**
   * Gets all supported tokens for a specific chain
   * @param chainId - Chain identifier
   * @returns Array of TokenConfig objects
   */
  getSupportedTokens(chainId: ChainIdentifier): TokenConfig[] {
    try {
      const chainType = ChainTypeDetector.detect(chainId);

      switch (chainType) {
        case ChainType.EVM: {
          const evmTokens = this.evmConfig.getSupportedTokens(Number(chainId));
          return evmTokens.map(this.mapEvmTokenConfig);
        }
        case ChainType.TVM: {
          const tvmTokens = this.tvmConfig.getSupportedTokens(chainId);
          return tvmTokens.map(this.mapTvmTokenConfig);
        }
        case ChainType.SVM:
          // For Solana, return empty array as we don't have token restrictions
          // This can be extended when Solana token configuration is added
          return [];
        default:
          return [];
      }
    } catch (error) {
      // If chain is not supported, return empty array
      return [];
    }
  }

  /**
   * Maps EVM token configuration to generic TokenConfig
   */
  private mapEvmTokenConfig(evmToken: EvmTokenConfig): TokenConfig {
    const config: TokenConfig = {
      address: AddressNormalizer.normalizeEvm(evmToken.address),
      decimals: evmToken.decimals,
    };

    if (evmToken.limit) {
      if (typeof evmToken.limit === 'number') {
        // Backward compatibility: a single number acts as max
        config.limit = { max: evmToken.limit };
      } else if (typeof evmToken.limit === 'object') {
        config.limit = {
          min: evmToken.limit.min,
          max: evmToken.limit.max,
        };
      }
    }

    return config;
  }

  /**
   * Maps TVM token configuration to generic TokenConfig
   */
  private mapTvmTokenConfig(tvmToken: TvmTokenConfig): TokenConfig {
    const config: TokenConfig = {
      address: AddressNormalizer.normalizeTvm(tvmToken.address),
      decimals: tvmToken.decimals,
    };

    if (tvmToken.limit) {
      if (typeof tvmToken.limit === 'number') {
        // Backward compatibility: single number acts as max
        config.limit = { max: tvmToken.limit };
      } else if (typeof tvmToken.limit === 'object') {
        config.limit = {
          min: tvmToken.limit.min,
          max: tvmToken.limit.max,
        };
      }
    }

    return config;
  }
}
