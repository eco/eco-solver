import { Injectable, Optional } from '@nestjs/common';

import { Address, Hex } from 'viem';

import { BaseChainReader } from '@/common/abstractions/base-chain-reader.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { ChainType, ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { BlockchainConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';

import { EvmReaderService } from './evm/services/evm.reader.service';
import { SvmReaderService } from './svm/services/svm.reader.service';
import { TvmReaderService } from './tvm/services/tvm.reader.service';

@Injectable()
export class BlockchainReaderService {
  private readers: Map<string | number, BaseChainReader> = new Map();

  constructor(
    private blockchainConfigService: BlockchainConfigService,
    private readonly logger: SystemLoggerService,
    @Optional() private evmReader?: EvmReaderService,
    @Optional() private svmReader?: SvmReaderService,
    @Optional() private tvmReader?: TvmReaderService,
  ) {
    this.logger.setContext(BlockchainReaderService.name);
    this.initializeReaders();
  }

  /**
   * Get all supported chain IDs
   * @returns Array of supported chain IDs (numbers for EVM, strings for non-EVM)
   */
  getSupportedChains(): Array<string | number> {
    return Array.from(this.readers.keys());
  }

  /**
   * Check if a chain is supported
   * @param chainId The chain ID to check
   * @returns true if the chain is supported
   */
  isChainSupported(chainId: string | number | bigint): boolean {
    // Convert bigint to number for EVM chains
    const normalizedChainId = typeof chainId === 'bigint' ? Number(chainId) : chainId;
    return this.readers.has(normalizedChainId);
  }

  /**
   * Get the reader for a specific chain
   * @param chainId The chain ID
   * @returns The reader for the chain, or undefined if not supported
   */
  getReaderForChain(chainId: string | number | bigint): BaseChainReader | undefined {
    // Convert bigint to number for EVM chains
    const normalizedChainId = typeof chainId === 'bigint' ? Number(chainId) : chainId;
    return this.readers.get(normalizedChainId);
  }

  /**
   * Get balance for an address on a specific chain
   * @param chainId The chain ID
   * @param address The address to check
   * @returns The balance in native token
   */
  async getBalance(chainId: string | number | bigint, address: string): Promise<bigint> {
    const reader = this.getReaderForChain(chainId);
    if (!reader) {
      throw new Error(`No reader available for chain ${chainId}`);
    }
    const normalizedChainId = typeof chainId === 'bigint' ? Number(chainId) : chainId;
    return reader.getBalance(address, normalizedChainId);
  }

  /**
   * Get token balance for an address on a specific chain
   * @param chainId The chain ID
   * @param tokenAddress The token contract address
   * @param walletAddress The wallet address to check
   * @returns The token balance
   */
  async getTokenBalance(
    chainId: string | number | bigint,
    tokenAddress: string,
    walletAddress: string,
  ): Promise<bigint> {
    const reader = this.getReaderForChain(chainId);
    if (!reader) {
      throw new Error(`No reader available for chain ${chainId}`);
    }
    const normalizedChainId = typeof chainId === 'bigint' ? Number(chainId) : chainId;
    return reader.getTokenBalance(tokenAddress, walletAddress, normalizedChainId);
  }

  /**
   * Check if an address is valid for a specific chain
   * @param chainId The chain ID
   * @param address The address to validate
   * @returns true if the address is valid for the chain
   */
  isAddressValid(chainId: string | number | bigint, address: string): boolean {
    const reader = this.getReaderForChain(chainId);
    if (!reader) {
      return false;
    }
    return reader.isAddressValid(address);
  }

  /**
   * Check if an intent is funded on a specific chain
   * @param chainId The chain ID
   * @param intent The intent to check
   * @returns true if the intent is funded
   */
  async isIntentFunded(chainId: string | number | bigint, intent: Intent): Promise<boolean> {
    const reader = this.getReaderForChain(chainId);
    if (!reader) {
      throw new Error(`No reader available for chain ${chainId}`);
    }
    const normalizedChainId = typeof chainId === 'bigint' ? Number(chainId) : chainId;
    return reader.isIntentFunded(intent, normalizedChainId);
  }

  /**
   * Fetch prover fee for an intent on a specific chain
   * @param chainId The chain ID
   * @param intent The intent to check
   * @param prover The prover address in the chain
   * @param messageData The message data
   * @param claimant The recipient of the rewards
   * @returns The prover fee amount in the chain's native token
   */
  async fetchProverFee(
    chainId: string | number | bigint,
    intent: Intent,
    prover: Address,
    messageData: Hex,
    claimant?: Address,
  ): Promise<bigint> {
    const reader = this.getReaderForChain(chainId);
    if (!reader) {
      throw new Error(`No reader available for chain ${chainId}`);
    }
    const normalizedChainId = typeof chainId === 'bigint' ? Number(chainId) : chainId;
    return reader.fetchProverFee(intent, prover, messageData, normalizedChainId, claimant);
  }

  private initializeReaders() {
    // Get all configured chains from the unified config service
    const configuredChains = this.blockchainConfigService.getAllConfiguredChains();

    for (const chainId of configuredChains) {
      try {
        const chainType = this.blockchainConfigService.getChainType(chainId);

        switch (chainType) {
          case ChainType.EVM:
            if (this.evmReader) {
              this.readers.set(chainId, this.evmReader);
            }
            break;
          case ChainType.TVM:
            if (this.tvmReader) {
              this.readers.set(chainId, this.tvmReader);
            }
            break;
          case ChainType.SVM:
            if (this.svmReader) {
              this.readers.set(chainId, this.svmReader);
            }
            break;
        }
      } catch (error) {
        this.logger.warn(`Failed to initialize reader for chain ${chainId}: ${error.message}`);
      }
    }
  }
}
