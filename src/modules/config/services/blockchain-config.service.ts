import { Injectable } from '@nestjs/common';

import { ChainType, ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { AssetsFeeSchemaType } from '@/config/schemas/fee.schema';

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
   * Gets the Portal address for any chain ID
   * Automatically detects chain type and retrieves from appropriate config
   */
  getPortalAddress(chainId: bigint | number | string): string {
    const chainType = ChainTypeDetector.detect(chainId);

    switch (chainType) {
      case ChainType.EVM:
        return this.evmConfig.getPortalAddress(Number(chainId));
      case ChainType.TVM:
        return this.tvmConfig.getPortalAddress(chainId);
      case ChainType.SVM:
        return this.solanaConfig.portalProgramId;
      default:
        throw new Error(`Unsupported chain type for chain ID: ${chainId}`);
    }
  }

  /**
   * Checks if a chain is configured in any blockchain type
   */
  isChainConfigured(chainId: bigint | number | string): boolean {
    try {
      const chainType = ChainTypeDetector.detect(chainId);

      switch (chainType) {
        case ChainType.EVM:
          return this.evmConfig.supportedChainIds.includes(Number(chainId));
        case ChainType.TVM:
          return this.tvmConfig.supportedChainIds.includes(chainId as string | number);
        case ChainType.SVM:
          return this.solanaConfig.isConfigured();
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Gets all configured chain IDs across all blockchain types
   */
  getAllConfiguredChains(): (number | string)[] {
    const chains: (number | string)[] = [];

    if (this.evmConfig.isConfigured()) {
      chains.push(...this.evmConfig.supportedChainIds);
    }

    if (this.tvmConfig.isConfigured()) {
      chains.push(...this.tvmConfig.supportedChainIds);
    }

    if (this.solanaConfig.isConfigured()) {
      chains.push('solana-mainnet', 'solana-devnet', 'solana-testnet');
    }

    return chains;
  }

  /**
   * Gets the chain type for any chain ID
   */
  getChainType(chainId: bigint | number | string): ChainType {
    return ChainTypeDetector.detect(chainId);
  }

  /**
   * Gets fee configuration for any chain ID
   * Automatically detects chain type and retrieves from appropriate config
   */
  getFeeLogic(chainId: bigint | number | string): AssetsFeeSchemaType {
    const chainType = ChainTypeDetector.detect(chainId);

    switch (chainType) {
      case ChainType.EVM:
        return this.evmConfig.getFeeLogic(Number(chainId));
      case ChainType.TVM:
        return this.tvmConfig.getFeeLogic(chainId);
      case ChainType.SVM:
        // Default fee configuration for Solana
        // Can be extended when Solana fee configuration is added to SolanaConfigService
        return {
          native: {
            flatFee: 5000, // 0.000005 SOL (5000 lamports)
            scalarBps: 0,
          },
          tokens: {
            flatFee: 5000, // 0.000005 SOL equivalent
            scalarBps: 10, // 0.1% fee
          },
        };
      default:
        throw new Error(`Unsupported chain type for chain ID: ${chainId}`);
    }
  }

  /**
   * Gets supported tokens for any chain ID
   * Returns array of token configurations with address and decimals
   */
  getSupportedTokens(
    chainId: bigint | number | string,
  ): Array<{ address: string; decimals: number; limit?: number | { min?: number; max?: number } }> {
    const chainType = ChainTypeDetector.detect(chainId);

    switch (chainType) {
      case ChainType.EVM:
        // Map to ensure required fields are present
        return this.evmConfig.getSupportedTokens(Number(chainId)).map((token) => ({
          address: token.address || '',
          decimals: token.decimals || 18,
          limit: token.limit,
        }));
      case ChainType.TVM:
        // Map to ensure required fields are present
        return this.tvmConfig.getSupportedTokens(chainId).map((token) => ({
          address: token.address || '',
          decimals: token.decimals || 6,
          limit: token.limit,
        }));
      case ChainType.SVM:
        // Solana doesn't have token restrictions in current config
        // Return empty array which means all SPL tokens are supported
        return [];
      default:
        throw new Error(`Unsupported chain type for chain ID: ${chainId}`);
    }
  }

  /**
   * Gets the prover contract address for any chain ID
   * Automatically detects chain type and retrieves from appropriate config
   * @param chainId The chain ID to get prover address for
   * @param proverType The type of prover ('hyper' or 'metalayer')
   * @returns The prover address or undefined if not configured
   */
  getProverAddress(
    chainId: bigint | number | string,
    proverType: 'hyper' | 'metalayer',
  ): string | undefined {
    const chainType = ChainTypeDetector.detect(chainId);

    switch (chainType) {
      case ChainType.EVM:
        return this.evmConfig.getProverAddress(Number(chainId), proverType);
      case ChainType.TVM:
        return this.tvmConfig.getProverAddress(chainId, proverType);
      case ChainType.SVM:
        // Solana doesn't have prover contracts in current configuration
        return undefined;
      default:
        throw new Error(`Unsupported chain type for chain ID: ${chainId}`);
    }
  }
}
