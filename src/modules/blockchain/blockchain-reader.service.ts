import { Injectable, Optional } from '@nestjs/common';

import { Hex } from 'viem';

import { BaseChainReader } from '@/common/abstractions/base-chain-reader.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { ChainType } from '@/common/utils/chain-type-detector';
import { getErrorMessage } from '@/common/utils/error-handler';
import { BlockchainConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';

import { EvmReaderService } from './evm/services/evm.reader.service';
import { SvmReaderService } from './svm/services/svm.reader.service';
import { TvmReaderService } from './tvm/services/tvm.reader.service';

@Injectable()
export class BlockchainReaderService {
  private readers: Map<number, BaseChainReader> = new Map();

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
  getSupportedChains(): Array<number> {
    return Array.from(this.readers.keys());
  }

  /**
   * Check if a chain is supported
   * @param chainId The chain ID to check
   * @returns true if the chain is supported
   */
  isChainSupported(chainId: number | bigint): boolean {
    // Convert bigint to number for EVM chains
    return this.readers.has(Number(chainId));
  }

  /**
   * Get the reader for a specific chain
   * @param chainId The chain ID
   * @returns The reader for the chain, or undefined if not supported
   */
  getReaderForChain(chainId: number | bigint): BaseChainReader {
    // Convert bigint to number for EVM chains
    const reader = this.readers.get(Number(chainId));

    if (!reader) {
      throw new Error(`No reader available for chain ${chainId}`);
    }

    return reader;
  }

  /**
   * Get balance for an address on a specific chain
   * @param chainId The chain ID
   * @param address The address to check
   * @returns The balance in native token
   */
  getBalance(chainId: number, address: UniversalAddress): Promise<bigint> {
    return this.getReaderForChain(chainId).getBalance(address, chainId);
  }

  /**
   * Get token balance for an address on a specific chain
   * @param chainId The chain ID
   * @param tokenAddress The token contract address
   * @param walletAddress The wallet address to check
   * @returns The token balance
   */
  async getTokenBalance(
    chainId: number | bigint,
    tokenAddress: UniversalAddress,
    walletAddress: UniversalAddress,
  ): Promise<bigint> {
    return this.getReaderForChain(chainId).getTokenBalance(
      tokenAddress,
      walletAddress,
      Number(chainId),
    );
  }

  /**
   * Check if an intent is funded on a specific chain
   * @param chainId The chain ID
   * @param intent The intent to check
   * @returns true if the intent is funded
   */
  async isIntentFunded(chainId: number | bigint, intent: Intent): Promise<boolean> {
    return this.getReaderForChain(chainId).isIntentFunded(intent, Number(chainId));
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
    chainId: number | bigint,
    intent: Intent,
    prover: UniversalAddress,
    messageData: Hex,
    claimant?: UniversalAddress,
  ): Promise<bigint> {
    return this.getReaderForChain(chainId).fetchProverFee(
      intent,
      prover,
      messageData,
      Number(chainId),
      claimant!,
    );
  }

  /**
   * Validate if a call is a valid token transfer call for a specific chain
   * @param chainId The chain ID
   * @param call The route call to validate
   * @returns true if the call is a valid token transfer
   */
  async validateTokenTransferCall(
    chainId: number | bigint,
    call: Intent['route']['calls'][number],
  ): Promise<boolean> {
    return this.getReaderForChain(chainId).validateTokenTransferCall(call, Number(chainId));
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
        this.logger.warn(
          `Failed to initialize reader for chain ${chainId}: ${getErrorMessage(error)}`,
        );
      }
    }
  }
}
