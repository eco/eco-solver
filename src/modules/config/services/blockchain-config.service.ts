import { Injectable } from '@nestjs/common';

import { TProverType } from '@/common/interfaces/prover.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { ChainType, ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { AssetsFeeSchemaType } from '@/config/schemas/fee.schema';
import { ChainIdentifier } from '@/modules/token/types/token.types';

import { IBlockchainConfigService, TokenConfig } from '../interfaces/blockchain-config.interface';

import { EvmConfigService } from './evm-config.service';
import { SolanaConfigService } from './solana-config.service';
import { TvmConfigService } from './tvm-config.service';

/**
 * Unified blockchain configuration service that provides cross-chain access
 * to configuration for all supported blockchain types (EVM, TVM, SVM).
 */
@Injectable()
export class BlockchainConfigService {
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
   * Gets the Portal address for any chain ID
   * Automatically detects chain type and retrieves from appropriate config
   */
  getPortalAddress(chainId: ChainIdentifier): UniversalAddress {
    const chainType = ChainTypeDetector.detect(chainId);
    const configService = this.getConfigService(chainType);
    return configService.getPortalAddress(chainId);
  }

  /**
   * Checks if a chain is configured in any blockchain type
   */
  isChainConfigured(chainId: ChainIdentifier): boolean {
    try {
      const chainType = ChainTypeDetector.detect(chainId);
      const configService = this.getConfigService(chainType);
      const supportedChains = configService.getSupportedChainIds();

      // For string chain IDs (like Solana), check directly
      if (typeof chainId === 'string') {
        return supportedChains.includes(chainId);
      }
      // For numeric chain IDs, convert to number and check
      return supportedChains.includes(Number(chainId));
    } catch {
      return false;
    }
  }

  /**
   * Gets all configured chain IDs across all blockchain types
   */
  getAllConfiguredChains(): number[] {
    const chains: number[] = [];

    if (this.evmConfig.isConfigured()) {
      chains.push(...this.evmConfig.getSupportedChainIds());
    }

    if (this.tvmConfig.isConfigured()) {
      chains.push(...this.tvmConfig.getSupportedChainIds());
    }

    if (this.solanaConfig.isConfigured()) {
      chains.push(...this.solanaConfig.getSupportedChainIds());
    }

    return chains;
  }

  /**
   * Gets the chain type for any chain ID
   */
  getChainType(chainId: ChainIdentifier): ChainType {
    return ChainTypeDetector.detect(chainId);
  }

  /**
   * Gets fee configuration for any chain ID
   * Automatically detects chain type and retrieves from appropriate config
   */
  getFeeLogic(chainId: ChainIdentifier): AssetsFeeSchemaType | undefined {
    const chainType = ChainTypeDetector.detect(chainId);
    const configService = this.getConfigService(chainType);
    return configService.getFeeLogic(chainId);
  }

  /**
   * Gets supported tokens for any chain ID
   * Returns array of token configurations with address, decimals, and symbol
   */
  getSupportedTokens(chainId: ChainIdentifier): TokenConfig[] {
    const chainType = ChainTypeDetector.detect(chainId);
    const configService = this.getConfigService(chainType);
    return configService.getSupportedTokens(chainId);
  }

  /**
   * Gets token configuration for a specific token on any chain
   * @param chainId Chain identifier
   * @param tokenAddress Token contract address
   * @returns Token configuration with address, decimals, symbol, and optional fee
   */
  getTokenConfig(chainId: ChainIdentifier, tokenAddress: UniversalAddress): TokenConfig {
    const chainType = ChainTypeDetector.detect(chainId);
    const configService = this.getConfigService(chainType);
    return configService.getTokenConfig(chainId, tokenAddress);
  }

  /**
   * Gets the prover contract address for any chain ID
   * Automatically detects chain type and retrieves from appropriate config
   * @param chainId The chain ID to get prover address for
   * @param proverType The type of prover ('hyper' or 'metalayer')
   * @returns The prover address or undefined if not configured
   */
  getProverAddress(
    chainId: ChainIdentifier,
    proverType: TProverType,
  ): UniversalAddress | undefined {
    const chainType = ChainTypeDetector.detect(chainId);
    const configService = this.getConfigService(chainType);
    return configService.getProverAddress(chainId, proverType);
  }

  /**
   * Gets the claimant address for any chain ID
   * Automatically detects chain type and retrieves from appropriate config
   * @param chainId The chain ID to get claimant address for
   * @returns The claimant address
   */
  getClaimant(chainId: ChainIdentifier): UniversalAddress {
    const chainType = ChainTypeDetector.detect(chainId);
    const configService = this.getConfigService(chainType);
    return configService.getClaimant(chainId);
  }

  /**
   * Gets the default prover type for any chain ID
   * Automatically detects chain type and retrieves from appropriate config
   * @param chainId The chain ID to get default prover for
   * @returns The default prover type
   */
  getDefaultProver(chainId: ChainIdentifier): TProverType {
    const chainType = ChainTypeDetector.detect(chainId);
    const configService = this.getConfigService(chainType);
    return configService.getDefaultProver(chainId);
  }

  /**
   * Gets all available prover types configured for a chain
   * @param chainId The chain ID to get available provers for
   * @returns Array of prover types that are configured for the chain
   */
  getAvailableProvers(chainId: ChainIdentifier): TProverType[] {
    const chainType = ChainTypeDetector.detect(chainId);
    const configService = this.getConfigService(chainType);
    return configService.getAvailableProvers(chainId);
  }
}
