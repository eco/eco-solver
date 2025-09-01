import { Injectable } from '@nestjs/common';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { ChainType, ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { EvmConfigService } from '@/modules/config/services/evm-config.service';
import { SolanaConfigService } from '@/modules/config/services/solana-config.service';
import { TvmConfigService } from '@/modules/config/services/tvm-config.service';
import { TokenConfig } from '@/modules/token/interfaces/token.interface';
import { ChainIdentifier } from '@/modules/token/types/token.types';

import { IBlockchainConfigService } from '../interfaces/blockchain-config.interface';

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
   * Gets the config service for a specific chain type
   * @private
   */
  private getConfigService(chainType: ChainType): IBlockchainConfigService {
    switch (chainType) {
      case ChainType.EVM:
        return this.evmConfig;
      case ChainType.TVM:
        return this.tvmConfig;
      case ChainType.SVM:
        return this.solanaConfig;
      default:
        throw new Error(`Unsupported chain type: ${chainType}`);
    }
  }

  /**
   * Checks if a token is supported on a specific chain
   * @param chainId - Chain identifier (number, string, or bigint)
   * @param tokenAddress - Token contract address
   * @returns true if token is supported, false otherwise
   */
  isTokenSupported(chainId: ChainIdentifier, tokenAddress: UniversalAddress): boolean {
    try {
      const chainType = ChainTypeDetector.detect(chainId);
      const configService = this.getConfigService(chainType);
      return configService.isTokenSupported(chainId, tokenAddress);
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
      const configService = this.getConfigService(chainType);
      const tokenConfig = configService.getTokenConfig(chainId, tokenAddress);

      // Map to TokenConfig interface
      const config: TokenConfig = {
        address: tokenConfig.address,
        decimals: tokenConfig.decimals,
      };

      if (tokenConfig.limit) {
        if (typeof tokenConfig.limit === 'number') {
          // Backward compatibility: single number acts as max
          config.limit = { max: tokenConfig.limit };
        } else if (typeof tokenConfig.limit === 'object') {
          config.limit = {
            min: tokenConfig.limit.min,
            max: tokenConfig.limit.max,
          };
        }
      }

      return config;
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
      const configService = this.getConfigService(chainType);
      const tokens = configService.getSupportedTokens(chainId);

      // Map to TokenConfig interface
      return tokens.map((token) => {
        const config: TokenConfig = {
          address: token.address,
          decimals: token.decimals,
        };

        if (token.limit) {
          if (typeof token.limit === 'number') {
            // Backward compatibility: single number acts as max
            config.limit = { max: token.limit };
          } else if (typeof token.limit === 'object') {
            config.limit = {
              min: token.limit.min,
              max: token.limit.max,
            };
          }
        }

        return config;
      });
    } catch (error) {
      // If chain is not supported, return empty array
      return [];
    }
  }
}
