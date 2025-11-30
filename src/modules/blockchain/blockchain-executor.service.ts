import { Injectable, Optional } from '@nestjs/common';

import { SpanStatusCode } from '@opentelemetry/api';

import { BaseChainExecutor } from '@/common/abstractions/base-chain-executor.abstract';
import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType } from '@/common/utils/chain-type-detector';
import { getErrorMessage } from '@/common/utils/error-handler';
import { WalletType } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
import { BlockchainConfigService } from '@/modules/config/services';
import { IntentsService } from '@/modules/intents/intents.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { RhinestoneMetadataService } from '@/modules/rhinestone/services/rhinestone-metadata.service';

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
    @Optional() private rhinestoneMetadataService?: RhinestoneMetadataService,
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
            // Don't update status to FAILED yet - let BullMQ retry
            this.logger.error(`Intent ${intent.intentHash} failed: ${result.error}`);

            span.setAttributes({
              'intent.error': result.error,
              'intent.fulfilled': false,
            });
            span.addEvent('intent.failed', {
              error: result.error,
            });
            span.setStatus({ code: SpanStatusCode.ERROR, message: result.error });
            span.end();
            throw new Error(result.error); // Trigger BullMQ retry
          }
        } catch (error) {
          this.logger.error(`Error executing intent ${intent.intentHash}:`, getErrorMessage(error));
          // Don't update status to FAILED yet - let BullMQ retry

          span.recordException(error as Error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
          throw error; // Re-throw to trigger BullMQ retry
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Execute Rhinestone 4-phase fulfillment flow
   * CLAIM (source) → FILL (destination) → PROVE (destination) → WITHDRAW (via existing system)
   * Retrieves Rhinestone payload from Redis metadata service
   * Preconfirmation is sent internally by EvmExecutorService after FILL tx submission
   */
  async executeRhinestone(intent: Intent, walletId?: WalletType): Promise<void> {
    return this.otelService.tracer.startActiveSpan(
      'rhinestone.execute',
      {
        attributes: {
          'intent.hash': intent.intentHash,
          'rhinestone.source_chain': intent.sourceChainId?.toString() || '',
          'rhinestone.destination_chain': intent.destination.toString(),
        },
      },
      async (span) => {
        try {
          // Retrieve Rhinestone payload from Redis
          const rhinestonePayload = await this.rhinestoneMetadataService!.get(intent.intentHash);
          if (!rhinestonePayload) {
            throw new Error(`No Rhinestone payload found in Redis for intent ${intent.intentHash}`);
          }

          span.setAttribute('rhinestone.payload_retrieved', true);

          const sourceChainId = Number(intent.sourceChainId);
          const destChainId = Number(intent.destination);

          // Get executors for both chains
          const sourceExecutor = this.getExecutorForChain(sourceChainId) as EvmExecutorService;
          const destExecutor = this.getExecutorForChain(destChainId) as EvmExecutorService;

          // Use provided walletId or default to 'basic'
          const effectiveWalletId = (walletId || 'basic') as WalletType;

          // Phase 1: CLAIM on source chain (Base)
          this.logger.log(`Rhinestone Phase 1: CLAIM on chain ${sourceChainId}`);
          span.addEvent('rhinestone.phase.claim.start');
          const claimTxHash = await sourceExecutor.executeRhinestoneClaim(
            sourceChainId,
            rhinestonePayload.claimTo,
            rhinestonePayload.claimData,
            rhinestonePayload.claimValue,
            effectiveWalletId,
          );
          span.setAttribute('rhinestone.claim_tx', claimTxHash);
          span.addEvent('rhinestone.phase.claim.complete', { txHash: claimTxHash });

          // Phase 2: FILL on destination chain (Arbitrum)
          this.logger.log(`Rhinestone Phase 2: FILL on chain ${destChainId}`);
          span.addEvent('rhinestone.phase.fill.start');

          // Calculate approval amounts from intent
          const requiredApprovals = intent.route.tokens.map(({ token, amount }) => ({
            token: AddressNormalizer.denormalizeToEvm(token),
            amount,
          }));

          const fillTxHash = await destExecutor.executeRhinestoneFill(
            destChainId,
            requiredApprovals,
            rhinestonePayload.fillTo,
            rhinestonePayload.fillData,
            rhinestonePayload.fillValue,
            effectiveWalletId,
            rhinestonePayload.messageId,
          );
          span.setAttribute('rhinestone.fill_tx', fillTxHash);
          span.addEvent('rhinestone.phase.fill.complete', { txHash: fillTxHash });

          // Phase 3: PROVE on destination chain
          this.logger.log(`Rhinestone Phase 3: PROVE on chain ${destChainId}`);
          span.addEvent('rhinestone.phase.prove.start');
          const { txHash: proveTxHash, receipt } = await destExecutor.executeRhinestoneProve(
            destChainId,
            intent,
            effectiveWalletId,
          );
          span.setAttribute('rhinestone.prove_tx', proveTxHash);
          span.addEvent('rhinestone.phase.prove.complete', { txHash: proveTxHash });

          // Mark as proven - withdrawal system handles Phase 4 automatically
          this.logger.log('Marking intent as proven for withdrawal system');

          this.logger.log(`Updating intent as proven for ${intent.intentHash}`, {
            claimant: await destExecutor.getWalletAddress(effectiveWalletId, BigInt(destChainId)),
            transactionHash: proveTxHash,
            blockNumber: receipt.blockNumber.toString(),
            timestamp: new Date().toISOString(),
            chainId: destChainId.toString(),
            txHash: proveTxHash,
          });

          const updatedIntent = await this.intentsService.updateProvenEvent({
            intentHash: intent.intentHash,
            claimant: await destExecutor.getWalletAddress(effectiveWalletId, BigInt(destChainId)),
            transactionHash: proveTxHash,
            blockNumber: receipt.blockNumber,
            timestamp: new Date(),
            chainId: BigInt(destChainId),
          });

          if (updatedIntent) {
            this.logger.log(`Successfully updated intent ${intent.intentHash} as proven`, {
              intentHash: intent.intentHash,
              claimant: updatedIntent.provenEvent?.claimant,
              transactionHash: updatedIntent.provenEvent?.txHash,
              blockNumber: updatedIntent.provenEvent?.blockNumber,
              timestamp: updatedIntent.provenEvent?.timestamp.toISOString(),
              chainId: updatedIntent.provenEvent?.chainId,
              txHash: updatedIntent.provenEvent?.txHash,
            });
          }

          // Update intent status
          await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FULFILLED);

          // Clean up Rhinestone payload from Redis
          await this.rhinestoneMetadataService!.delete(intent.intentHash);
          this.logger.log('Cleaned up Rhinestone payload from Redis');

          this.logger.log(`Rhinestone fulfillment complete: ${intent.intentHash}`);
          span.setStatus({ code: SpanStatusCode.OK });
        } catch (error) {
          this.logger.error(
            `Rhinestone fulfillment failed for ${intent.intentHash}:`,
            getErrorMessage(error),
          );
          await this.intentsService.updateStatus(intent.intentHash, IntentStatus.FAILED);

          // Clean up payload even on failure
          await this.rhinestoneMetadataService!.delete(intent.intentHash);

          span.recordException(error as Error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
          throw error;
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
        this.logger.warn(
          `Failed to initialize executor for chain ${chainId}: ${getErrorMessage(error)}`,
        );
      }
    }
  }
}
