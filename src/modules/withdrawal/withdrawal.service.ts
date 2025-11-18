import { Injectable, Inject, Optional } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { ChainTypeDetector, ChainType } from '@/common/utils/chain-type-detector';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { SvmProofCheckerService } from '@/modules/blockchain/svm/services/svm-proof-checker.service';
import { IntentsService } from '@/modules/intents/intents.service';
import { IntentConverter } from '@/modules/intents/utils/intent-converter';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { BatchWithdrawData } from './interfaces/withdrawal-job.interface';

@Injectable()
export class WithdrawalService {
  constructor(
    private readonly intentsService: IntentsService,
    private readonly blockchainExecutor: BlockchainExecutorService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    @Optional() @Inject(SvmProofCheckerService) private readonly svmProofChecker?: SvmProofCheckerService,
  ) {
    this.logger.setContext(WithdrawalService.name);
  }

  /**
   * Find all proven intents that haven't been withdrawn yet
   * For Solana chains, checks on-chain proof accounts instead of relying on events
   */
  async findIntentsForWithdrawal(sourceChainId?: bigint): Promise<Intent[]> {
    return this.otelService.tracer.startActiveSpan(
      'withdrawal.findIntentsForWithdrawal',
      {
        attributes: {
          'withdrawal.source_chain_id': sourceChainId?.toString(),
        },
      },
      async (span) => {
        try {
          // First get intents from DB that have provenEvent
          const intentsFromDb = await this.intentsService.findProvenNotWithdrawn(sourceChainId);
          let intents = intentsFromDb.map((intent) => IntentConverter.toInterface(intent));

          // For Solana chains, also check on-chain for fulfilled intents without provenEvent
          if (this.svmProofChecker) {
            const solanaIntents = await this.findSolanaIntentsWithOnChainProofs(sourceChainId);
            // Merge with existing intents (avoid duplicates)
            const intentHashSet = new Set(intents.map((i) => i.intentHash));
            for (const intent of solanaIntents) {
              if (!intentHashSet.has(intent.intentHash)) {
                intents.push(intent);
                this.logger.log(
                  `Found Solana intent ${intent.intentHash} with on-chain proof (not from event)`,
                );
              }
            }
          }

          span.setAttributes({
            'withdrawal.intent_count': intents.length,
          });

          this.logger.log(
            `Found ${intents.length} proven intents for withdrawal${
              sourceChainId ? ` on chain ${sourceChainId}` : ''
            }`,
          );

          span.setStatus({ code: api.SpanStatusCode.OK });
          return intents;
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Find Solana intents that have on-chain proofs but may not have provenEvent
   */
  private async findSolanaIntentsWithOnChainProofs(sourceChainId?: bigint): Promise<Intent[]> {
    if (!this.svmProofChecker) {
      return [];
    }

    try {
      // Find fulfilled Solana intents that don't have provenEvent yet
      const fulfilledIntents = await this.intentsService.findFulfilledNotProven(sourceChainId);
      const intents = fulfilledIntents.map((intent) => IntentConverter.toInterface(intent));
      // Filter to only Solana chains
      const solanaIntents = intents.filter((intent) => {
        const chainType = ChainTypeDetector.detect(intent.sourceChainId);
        return chainType === ChainType.SVM;
      });
      if (solanaIntents.length === 0) {
        return [];
      }

      this.logger.log(
        `Checking ${solanaIntents.length} Solana fulfilled intents for on-chain proofs`,
      );

      // Check which ones have on-chain proofs
      const provenIntents: Intent[] = [];
      for (const intent of solanaIntents) {
        const result = await this.svmProofChecker.checkIntentProven(
          intent.intentHash,
          intent.reward.prover,
        );

        if (result.proven) {
          // Mark intent as proven in database with actual transaction signature
          await this.markIntentAsProven(intent, result.transactionSignature);
          provenIntents.push(intent);
        }
      }

      this.logger.log(`Found ${provenIntents.length} Solana intents with on-chain proofs`);
      return provenIntents;
    } catch (error) {
      this.logger.error('Error finding Solana intents with on-chain proofs:', toError(error));
      return [];
    }
  }

  /**
   * Mark an intent as proven in the database
   */
  private async markIntentAsProven(intent: Intent, transactionSignature?: string): Promise<void> {
    try {
      await this.intentsService.updateProvenEvent({
        intentHash: intent.intentHash,
        claimant: intent.reward.creator,
        transactionHash: transactionSignature || 'on-chain-proof-detected',
        chainId: intent.sourceChainId,
        timestamp: new Date(),
      });
      this.logger.log(
        `Marked intent ${intent.intentHash} as proven via on-chain proof check (tx: ${transactionSignature || 'unknown'})`,
      );
    } catch (error) {
      this.logger.error(`Failed to mark intent ${intent.intentHash} as proven:`, toError(error));
    }
  }

  /**
   * Group intents by source chain for batch processing
   */
  groupIntentsByChain(intents: Intent[]): Map<bigint, Intent[]> {
    const grouped = new Map<bigint, Intent[]>();

    for (const intent of intents) {
      const chainId = intent.sourceChainId;
      if (!chainId) continue;

      if (!grouped.has(chainId)) {
        grouped.set(chainId, []);
      }
      grouped.get(chainId)!.push(intent);
    }

    return grouped;
  }

  /**
   * Execute batch withdrawal for a set of intents on a specific chain
   */
  async executeWithdrawal(chainId: bigint, intents: Intent[], walletId?: string): Promise<string> {
    return this.otelService.tracer.startActiveSpan(
      'withdrawal.executeWithdrawal',
      {
        attributes: {
          'withdrawal.chain_id': chainId.toString(),
          'withdrawal.intent_count': intents.length,
          'withdrawal.wallet_id': walletId,
        },
      },
      async (span) => {
        try {
          this.logger.log(`Executing withdrawal for ${intents.length} intents on chain ${chainId}`);

          const withdrawalData = this.prepareWithdrawalData(intents);

          // Get the appropriate executor for the chain
          const executor = this.blockchainExecutor.getExecutorForChain(chainId);

          // Execute the batch withdrawal
          const txHash = await executor.executeBatchWithdraw(chainId, withdrawalData, walletId);

          span.setAttributes({
            'withdrawal.tx_hash': txHash,
          });

          this.logger.log(
            `Successfully executed withdrawal for ${intents.length} intents on chain ${chainId}. TxHash: ${txHash}`,
          );

          span.setStatus({ code: api.SpanStatusCode.OK });
          return txHash;
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          this.logger.error(
            `Failed to execute withdrawal for chain ${chainId}: ${getErrorMessage(error)}`,
            toError(error),
          );
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Process withdrawals for all chains
   */
  async processAllWithdrawals(): Promise<Map<bigint, string>> {
    return this.otelService.tracer.startActiveSpan(
      'withdrawal.processAllWithdrawals',
      {},
      async (span) => {
        try {
          const intents = await this.findIntentsForWithdrawal();
          const groupedIntents = this.groupIntentsByChain(intents);

          const results = new Map<bigint, string>();

          for (const [chainId, chainIntents] of groupedIntents) {
            try {
              const txHash = await this.executeWithdrawal(chainId, chainIntents);
              results.set(chainId, txHash);
            } catch (error) {
              this.logger.error(
                `Failed to process withdrawals for chain ${chainId}`,
                toError(error),
              );
            }
          }

          span.setAttributes({
            'withdrawal.chains_processed': results.size,
            'withdrawal.total_intents': intents.length,
          });

          span.setStatus({ code: api.SpanStatusCode.OK });
          return results;
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Prepare withdrawal data for batch withdrawal
   */
  private prepareWithdrawalData(intents: Intent[]): BatchWithdrawData {
    return {
      destinations: intents.map((i) => i.destination),
      routeHashes: intents.map((i) => {
        const { routeHash } = PortalHashUtils.getIntentHash(i);
        return routeHash;
      }),
      rewards: intents.map((i) => ({
        deadline: i.reward.deadline,
        creator: i.reward.creator,
        prover: i.reward.prover,
        nativeAmount: i.reward.nativeAmount,
        tokens: i.reward.tokens.map((t) => ({
          token: t.token,
          amount: t.amount,
        })),
      })),
    };
  }
}
