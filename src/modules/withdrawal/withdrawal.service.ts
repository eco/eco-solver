import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { Intent } from '@/common/interfaces/intent.interface';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { IntentsService } from '@/modules/intents/intents.service';
import { IntentConverter } from '@/modules/intents/utils/intent-converter';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { BatchWithdrawData } from './interfaces/withdrawal-job.interface';

@Injectable()
export class WithdrawalService {
  constructor(
    @InjectPinoLogger(WithdrawalService.name)
    private readonly logger: PinoLogger,
    private readonly intentsService: IntentsService,
    private readonly blockchainExecutor: BlockchainExecutorService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  /**
   * Find all proven intents that haven't been withdrawn yet
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
          const intentsFromDb = await this.intentsService.findProvenNotWithdrawn(sourceChainId);
          const intents = intentsFromDb.map((intent) => IntentConverter.toInterface(intent));

          span.setAttributes({
            'withdrawal.intent_count': intents.length,
          });

          this.logger.info(
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
          this.logger.info(
            `Executing withdrawal for ${intents.length} intents on chain ${chainId}`,
          );

          const withdrawalData = this.prepareWithdrawalData(intents);

          // Get the appropriate executor for the chain
          const executor = this.blockchainExecutor.getExecutorForChain(chainId);

          // Execute the batch withdrawal
          const txHash = await executor.executeBatchWithdraw(chainId, withdrawalData, walletId);

          span.setAttributes({
            'withdrawal.tx_hash': txHash,
          });

          this.logger.info(
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
