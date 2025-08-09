import { Injectable, Optional } from '@nestjs/common';

import { BaseChainExecutor } from '@/common/abstractions/base-chain-executor.abstract';
import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { WalletType } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
import { EvmConfigService, SolanaConfigService } from '@/modules/config/services';
import { IntentsService } from '@/modules/intents/intents.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { EvmExecutorService } from './evm/services/evm.executor.service';
import { SvmExecutorService } from './svm/services/svm.executor.service';

@Injectable()
export class BlockchainExecutorService {
  private executors: Map<string | number, BaseChainExecutor> = new Map();

  constructor(
    private evmConfigService: EvmConfigService,
    private solanaConfigService: SolanaConfigService,
    private intentsService: IntentsService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    @Optional() private evmExecutor?: EvmExecutorService,
    @Optional() private svmExecutor?: SvmExecutorService,
  ) {
    this.logger.setContext(BlockchainExecutorService.name);
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
  getExecutorForChain(chainId: string | number | bigint): BaseChainExecutor {
    // Convert bigint to number for EVM chains
    const normalizedChainId = typeof chainId === 'bigint' ? Number(chainId) : chainId;
    const executor = this.executors.get(normalizedChainId);
    if (!executor) {
      throw new Error(`No executor for chain ${chainId}`);
    }
    return executor;
  }

  async executeIntent(intent: Intent, walletId?: WalletType): Promise<void> {
    const span = this.otelService.startSpan('intent.blockchain.execute', {
      attributes: {
        'intent.id': intent.intentHash,
        'intent.destination_chain': intent.route.destination.toString(),
        'intent.wallet_type': walletId || 'default',
        'intent.route.tokens_count': intent.route.tokens.length,
        'intent.route.calls_count': intent.route.calls.length,
      },
    });

    try {
      const executor = this.getExecutorForChain(intent.route.destination);
      span.addEvent('intent.executor.selected', {
        executor: executor.constructor.name,
      });

      const result = await executor.fulfill(intent, walletId);

      if (result.success) {
        await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FULFILLED);
        this.logger.log(`Intent ${intent.intentHash} fulfilled: ${result.txHash}`);

        span.setAttributes({
          'intent.tx_hash': result.txHash,
          'intent.fulfilled': true,
        });
        span.addEvent('intent.fulfilled', {
          txHash: result.txHash,
        });
        span.setStatus({ code: 0 }); // OK
      } else {
        await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FAILED);
        this.logger.error(`Intent ${intent.intentHash} failed: ${result.error}`);

        span.setAttributes({
          'intent.error': result.error,
          'intent.fulfilled': false,
        });
        span.addEvent('intent.failed', {
          error: result.error,
        });
        span.setStatus({ code: 2, message: result.error });
      }

      span.end();
    } catch (error) {
      this.logger.error(`Error executing intent ${intent.intentHash}:`, error.message);
      await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FAILED);

      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });
      span.end();
    }
  }
}
