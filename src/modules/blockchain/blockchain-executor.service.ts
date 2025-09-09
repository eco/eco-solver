import { Injectable, Optional } from '@nestjs/common';

import { BaseChainExecutor } from '@/common/abstractions/base-chain-executor.abstract';
import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { ChainType, ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { getErrorMessage } from '@/common/utils/error-handler';
import { WalletType } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
import { BlockchainConfigService } from '@/modules/config/services';
import { IntentsService } from '@/modules/intents/intents.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { EvmExecutorService } from './evm/services/evm.executor.service';
import { SvmExecutorService } from './svm/services/svm.executor.service';
import { TvmExecutorService } from './tvm/services/tvm.executor.service';

@Injectable()
export class BlockchainExecutorService {
  private executors: Map<string | number, BaseChainExecutor> = new Map();

  constructor(
    private blockchainConfigService: BlockchainConfigService,
    private intentsService: IntentsService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    @Optional() private evmExecutor?: EvmExecutorService,
    @Optional() private svmExecutor?: SvmExecutorService,
    @Optional() private tvmExecutor?: TvmExecutorService,
  ) {
    this.logger.setContext(BlockchainExecutorService.name);
    this.initializeExecutors();
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
    return this.executors.has(Number(chainId));
  }

  /**
   * Get the executor for a specific chain
   * @param chainId The chain ID
   * @returns The executor for the chain, or undefined if not supported
   */
  getExecutorForChain(chainId: string | number | bigint): BaseChainExecutor {
    // Convert bigint to number for EVM chains
    const executor = this.executors.get(Number(chainId));
    if (!executor) {
      throw new Error(`No executor for chain ${chainId}`);
    }
    return executor;
  }

  async executeIntent(intent: Intent, walletId?: WalletType): Promise<void> {
    const span = this.otelService.startSpan('intent.blockchain.execute', {
      attributes: {
        'intent.hash': intent.intentHash,
        'intent.destination_chain': intent.destination.toString(),
        'intent.wallet_type': walletId || 'default',
        'intent.route.tokens_count': intent.route.tokens.length,
        'intent.route.calls_count': intent.route.calls.length,
      },
    });

    try {
      // Validate wallet type for the destination chain
      const chainType = ChainTypeDetector.detect(intent.destination);
      if (chainType === ChainType.TVM && walletId === 'kernel') {
        throw new Error(
          'Kernel wallet is not supported for TVM chains. Please use basic wallet type.',
        );
      }

      const executor = this.getExecutorForChain(intent.destination);
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
          chainId: intent.destination.toString(),
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
      this.logger.error(`Error executing intent ${intent.intentHash}:`, getErrorMessage(error));
      await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FAILED);

      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });
      span.end();
    }
  }

  private initializeExecutors() {
    // Get all configured chains from the unified config service
    const configuredChains = this.blockchainConfigService.getAllConfiguredChains();

    for (const chainId of configuredChains) {
      try {
        const chainType = this.blockchainConfigService.getChainType(chainId);

        switch (chainType) {
          case ChainType.EVM:
            if (this.evmExecutor) {
              this.executors.set(chainId, this.evmExecutor);
            }
            break;
          case ChainType.TVM:
            if (this.tvmExecutor) {
              this.executors.set(chainId, this.tvmExecutor);
            }
            break;
          case ChainType.SVM:
            if (this.svmExecutor) {
              this.executors.set(chainId, this.svmExecutor);
            }
            break;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to initialize executor for chain ${chainId}: ${getErrorMessage(error)}`,
        );
      }
    }
  }
}
