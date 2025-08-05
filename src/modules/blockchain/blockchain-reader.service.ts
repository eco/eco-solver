import { Injectable, Logger, Optional } from '@nestjs/common';

import { BaseChainReader } from '@/common/abstractions/base-chain-reader.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { EvmConfigService, SolanaConfigService } from '@/modules/config/services';

import { EvmReaderService } from './evm/evm.reader.service';
import { SvmReaderService } from './svm/svm.reader.service';

@Injectable()
export class BlockchainReaderService {
  private readonly logger = new Logger(BlockchainReaderService.name);
  private readers: Map<string | number, BaseChainReader> = new Map();

  constructor(
    private evmConfigService: EvmConfigService,
    private solanaConfigService: SolanaConfigService,
    @Optional() private evmReader?: EvmReaderService,
    @Optional() private svmReader?: SvmReaderService,
  ) {
    this.initializeReaders();
  }

  private initializeReaders() {
    // Register EVM reader only if available and configured
    if (this.evmReader && this.evmConfigService.isConfigured()) {
      const evmChainIds = this.evmConfigService.supportedChainIds;
      for (const chainId of evmChainIds) {
        // Create a new instance for each chain with chainId set
        const reader = Object.create(this.evmReader);
        reader.setChainId(chainId);
        this.readers.set(chainId, reader);
      }
    }

    // Register SVM reader only if available and configured
    if (this.svmReader && this.solanaConfigService.isConfigured()) {
      this.readers.set('solana-mainnet', this.svmReader);
      this.readers.set('solana-devnet', this.svmReader);
    }
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
    return reader.getBalance(address);
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
    return reader.getTokenBalance(tokenAddress, walletAddress);
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
    return reader.isIntentFunded(intent);
  }

  /**
   * Determine chain ID from token address format
   * @param tokenAddress The token address
   * @returns The chain ID if determinable, null otherwise
   */
  getChainIdFromAddress(tokenAddress: string): string | number | null {
    // Check if it's a valid EVM address
    if (this.evmReader && this.evmReader.isAddressValid(tokenAddress)) {
      // For EVM, we can't determine chain from address alone
      // Would need additional context
      return null;
    }

    // Check if it's a valid Solana address
    if (this.svmReader && this.svmReader.isAddressValid(tokenAddress)) {
      // For Solana, we default to mainnet
      // Could be enhanced to detect devnet/testnet
      return 'solana-mainnet';
    }

    return null;
  }
}
