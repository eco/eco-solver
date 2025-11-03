import { Injectable, Optional } from '@nestjs/common';

import { SpanStatusCode } from '@opentelemetry/api';

import { BaseChainExecutor } from '@/common/abstractions/base-chain-executor.abstract';
import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { ChainType } from '@/common/utils/chain-type-detector';
import { toError } from '@/common/utils/error-handler';
import { WalletType } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
import { BlockchainConfigService } from '@/modules/config/services';
import { IntentsService } from '@/modules/intents/intents.service';
import { Logger } from '@/modules/logging';
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
    private readonly otelService: OpenTelemetryService,
    private readonly logger: Logger,
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
    return this.otelService.tracer.startActiveSpan(
      'intent.blockchain.execute',
      {
        attributes: {
          'intent.hash': intent.intentHash,
          'intent.destination_chain': intent.destination.toString(),
          'intent.wallet_type': walletId || 'default',
          'intent.route.tokens_count': intent.route.tokens.length,
          'intent.route.calls_count': intent.route.calls.length,
        },
      },
      async (span) => {
        try {
          // Validate wallet type for the destination chain
          const executor = this.getExecutorForChain(intent.destination);
          span.addEvent('intent.executor.selected', {
            executor: executor.constructor.name,
          });

          const result = await executor.fulfill(intent, walletId);

          if (result.success) {
            await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FULFILLED);
            this.logger.info('Intent fulfilled successfully', {
              intentHash: intent.intentHash,
              txHash: result.txHash,
              destinationChain: intent.destination.toString(),
            });

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
            this.logger.error('Intent fulfillment failed', {
              intentHash: intent.intentHash,
              error: result.error,
              destinationChain: intent.destination.toString(),
            });

            span.setAttributes({
              'intent.error': result.error,
              'intent.fulfilled': false,
            });
            span.addEvent('intent.failed', {
              error: result.error,
            });
            span.setStatus({ code: SpanStatusCode.ERROR, message: result.error });
            span.end();
            throw new Error(result.error);
          }
        } catch (error) {
          this.logger.error('Error executing intent', error, {
            intentHash: intent.intentHash,
            destinationChain: intent.destination.toString(),
          });
          await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FAILED);

          span.recordException(error as Error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
          throw error; // Re-throw to trigger BullMQ retry
        } finally {
          span.end();
        }
      },
    );
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
        this.logger.warn('Failed to initialize executor for chain', {
          error: toError(error),
          chainId,
        });
      }
    }
  }
}
