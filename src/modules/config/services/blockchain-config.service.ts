import { Injectable } from '@nestjs/common';

import { ChainType, ChainTypeDetector } from '@/common/utils/chain-type-detector';

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
        return this.tvmConfig.getPortalAddress(chainId as string | number);
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
}
