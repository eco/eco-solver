import { Injectable, Optional } from '@nestjs/common';

import { BaseChainExecutor } from '@/common/abstractions/base-chain-executor.abstract';
import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { EvmConfigService, SolanaConfigService } from '@/modules/config/services';
import { IntentsService } from '@/modules/intents/intents.service';

import { EvmExecutorService } from './evm/evm.executor.service';
import { SvmExecutorService } from './svm/svm.executor.service';

@Injectable()
export class BlockchainExecutorService {
  private executors: Map<string | number, BaseChainExecutor> = new Map();

  constructor(
    private evmConfigService: EvmConfigService,
    private solanaConfigService: SolanaConfigService,
    private intentsService: IntentsService,
    @Optional() private evmExecutor?: EvmExecutorService,
    @Optional() private svmExecutor?: SvmExecutorService,
  ) {
    this.initializeExecutors();
  }

  private initializeExecutors() {
    // Register EVM executor only if available and configured
    if (this.evmExecutor && this.evmConfigService.isConfigured()) {
      const evmChainIds = this.evmConfigService.supportedChainIds;
      for (const chainId of evmChainIds) {
        this.executors.set(chainId, this.evmExecutor);
      }
    }

    // Register SVM executor only if available and configured
    if (this.svmExecutor && this.solanaConfigService.isConfigured()) {
      this.executors.set('solana-mainnet', this.svmExecutor);
      this.executors.set('solana-devnet', this.svmExecutor);
    }
  }

  /**
   * Get all supported chain IDs
   * @returns Array of supported chain IDs (numbers for EVM, strings for non-EVM)
   */
  getSupportedChains(): Array<string | number> {
    return Array.from(this.executors.keys());
  }

  /**
   * Check if a chain is supported
   * @param chainId The chain ID to check
   * @returns true if the chain is supported
   */
  isChainSupported(chainId: string | number | bigint): boolean {
    // Convert bigint to number for EVM chains
    const normalizedChainId = typeof chainId === 'bigint' ? Number(chainId) : chainId;
    return this.executors.has(normalizedChainId);
  }

  /**
   * Get the executor for a specific chain
   * @param chainId The chain ID
   * @returns The executor for the chain, or undefined if not supported
   */
  getExecutorForChain(chainId: string | number | bigint): BaseChainExecutor | undefined {
    // Convert bigint to number for EVM chains
    const normalizedChainId = typeof chainId === 'bigint' ? Number(chainId) : chainId;
    return this.executors.get(normalizedChainId);
  }

  async executeIntent(intent: Intent, walletId?: string): Promise<void> {
    try {
      const executor = this.getExecutorForChain(intent.route.destination);
      if (!executor) {
        throw new Error(`No executor for chain ${intent.route.destination}`);
      }

      const result = await executor.fulfill(intent, walletId);

      if (result.success) {
        await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FULFILLED);
        console.log(`Intent ${intent.intentHash} fulfilled: ${result.txHash}`);
      } else {
        await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FAILED);
        console.error(`Intent ${intent.intentHash} failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`Error executing intent ${intent.intentHash}:`, error);
      await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FAILED);
    }
  }
}
