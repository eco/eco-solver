import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import * as api from '@opentelemetry/api';
import { Model } from 'mongoose';
import { Hex } from 'viem';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { Permit3Validator } from '@/common/utils/permit3-validator';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';
import {
  AllowanceOrTransfer as MerkleAllowanceOrTransfer,
  StandardMerkleBuilder,
} from '@/common/utils/standard-merkle-builder';
import { QuotesService } from '@/modules/api/quotes/services/quotes.service';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { QuoteRepository } from '@/modules/intents/repositories/quote.repository';
import { IntentDataSchema } from '@/modules/intents/schemas/intent-data.schema';
import { Quote } from '@/modules/intents/schemas/quote.schema';
import { LoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { GaslessInitiation, GaslessInitiationDocument } from '../schemas/gasless-initiation.schema';
import {
  AllowanceOrTransfer,
  GaslessIntentRequest,
  Permit3,
} from '../schemas/gasless-intent-request.schema';
import {
  GaslessIntentExecutionResponseEntry,
  GaslessIntentResponse,
} from '../schemas/gasless-intent-response.schema';

/**
 * Service for handling gasless intent initiation
 * Orchestrates permit generation, transaction creation, and execution
 */
@Injectable()
export class GaslessIntentsService {
  private readonly merkleBuilder = new StandardMerkleBuilder();

  constructor(
    @InjectModel(GaslessInitiation.name)
    private readonly gaslessInitiationModel: Model<GaslessInitiationDocument>,
    private readonly quoteRepository: QuoteRepository,
    private readonly quotesService: QuotesService,
    private readonly blockchainExecutor: BlockchainExecutorService,
    private readonly logger: LoggerService,
    private readonly otelService: OpenTelemetryService,
  ) {
    this.logger.setContext(GaslessIntentsService.name);
  }

  /**
   * Main entry point for initiating gasless intents
   */
  async initiateGaslessIntent(request: GaslessIntentRequest): Promise<GaslessIntentResponse> {
    return this.otelService.tracer.startActiveSpan(
      'gasless-intents.initiateGaslessIntent',
      {
        attributes: {
          'gasless.initiation_id': request.gaslessInitiationId,
          'gasless.dapp_id': request.dAppID,
          'gasless.intent_count': request.intents.length,
          'gasless.permit_count': request.gaslessIntentData.permit3.allowanceOrTransfers.length,
        },
      },
      async (span) => {
        try {
          const { gaslessInitiationId, dAppID, intents, gaslessIntentData } = request;

          this.logger.log(`Initiating gasless intent`, {
            gaslessInitiationId,
            dAppID,
            intentCount: intents.length,
          });

          // Validate Permit3 signature
          await this.validatePermit3(gaslessIntentData.permit3);

          // Group permits by chain for Merkle tree construction
          const permitsByChain = this.groupPermitsByChain(
            gaslessIntentData.permit3.allowanceOrTransfers,
          );

          // Build a Merkle tree and get proofs
          const { merkleRoot, proofsByChainId } =
            this.merkleBuilder.createCrossChainProofs(permitsByChain);

          // Verify merkleRoot matches the one in the permit
          if (merkleRoot !== gaslessIntentData.permit3.merkleRoot) {
            throw new BadRequestException('Merkle root mismatch');
          }

          // Group intents by source chain
          const intentsByChain = await this.groupIntentsByChain(intents);

          // Execute transactions for each chain in parallel
          const executionPromises = Array.from(intentsByChain.entries()).map(
            ([chainId, chainIntents]) =>
              this.executeChainTransactions(
                chainId,
                chainIntents,
                gaslessIntentData.permit3,
                proofsByChainId.get(BigInt(chainId))!.proof,
                gaslessIntentData.allowPartial ?? false,
              ),
          );

          const settledResults = await Promise.allSettled(executionPromises);

          // Separate successes and failures
          const successes: GaslessIntentExecutionResponseEntry[] = [];
          const failures: GaslessIntentExecutionResponseEntry[] = [];

          for (const result of settledResults) {
            if (result.status === 'fulfilled') {
              const response = result.value;
              if (response.error) {
                failures.push(response);
              } else {
                successes.push(response);
              }
            } else {
              // Promise rejection (unexpected)
              this.logger.error(`Unexpected transaction execution rejection: ${result.reason}`);
            }
          }

          // Store initiation metadata
          await this.storeInitiation(gaslessInitiationId, gaslessIntentData.permit3);

          this.logger.log(`Gasless intent initiation completed`, {
            gaslessInitiationId,
            successes: successes.length,
            failures: failures.length,
          });

          span.setAttributes({
            'gasless.success_count': successes.length,
            'gasless.failure_count': failures.length,
          });

          span.setStatus({ code: api.SpanStatusCode.OK });

          return { successes, failures };
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Validate Permit3 signature
   */
  private async validatePermit3(permit3: Permit3): Promise<void> {
    return this.otelService.tracer.startActiveSpan(
      'gasless-intents.validatePermit3',
      {
        attributes: {
          'permit3.owner': permit3.owner,
          'permit3.deadline': permit3.deadline.toString(),
          'permit3.permit_contract': permit3.permitContract,
        },
      },
      async (span) => {
        try {
          await Permit3Validator.validatePermit({
            owner: permit3.owner as Hex,
            salt: permit3.salt as Hex,
            deadline: permit3.deadline,
            timestamp: permit3.timestamp,
            merkleRoot: permit3.merkleRoot as Hex,
            signature: permit3.signature as Hex,
            permitContract: permit3.permitContract as Hex,
          });

          this.logger.debug('Permit3 validation passed');

          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Group intents by their source chain
   */
  private async groupIntentsByChain(intents: Array<{ quoteID: string; salt: string }>) {
    const intentsByChain = new Map<number, Array<{ quoteID: string; salt: Hex; quote: Quote }>>();

    for (const intent of intents) {
      const { quoteID, salt } = intent;

      // Fetch quote from database
      const quote = await this.quoteRepository.getByQuoteId(quoteID);
      const chainId = quote.sourceChainID;

      // Initialize chain group if needed
      if (!intentsByChain.has(chainId)) {
        intentsByChain.set(chainId, []);
      }

      intentsByChain.get(chainId)!.push({
        quoteID,
        salt: salt as Hex,
        quote,
      });
    }

    return intentsByChain;
  }

  /**
   * Execute permit3 and fundFor transactions for a single chain
   */
  private async executeChainTransactions(
    chainId: number,
    chainIntents: Array<{ quoteID: string; salt: Hex; quote: Quote }>,
    permit3: Permit3,
    merkleProof: Hex[],
    allowPartial: boolean,
  ): Promise<GaslessIntentExecutionResponseEntry> {
    return this.otelService.tracer.startActiveSpan(
      'gasless-intents.executeChainTransactions',
      {
        attributes: {
          'chain.id': chainId.toString(),
          'chain.intent_count': chainIntents.length,
          'chain.allow_partial': allowPartial,
        },
      },
      async (span) => {
        const quoteIDs = chainIntents.map((intent) => intent.quoteID);

        try {
          this.logger.debug(
            `Executing transactions on chain ${chainId} for ${chainIntents.length} intents`,
          );

          // Get executor for this chain
          const executor = this.blockchainExecutor.getExecutorForChain(chainId);

          // Prepare permits for this chain
          const chainPermits = permit3.allowanceOrTransfers
            .filter((p) => p.chainID === chainId)
            .map((p) => ({
              modeOrExpiration: p.modeOrExpiration,
              tokenKey: p.tokenKey as Hex,
              account: p.account as UniversalAddress,
              amountDelta: p.amountDelta,
            }));

          // Execute permit3 transaction (once per chain)
          const permit3TxHash = await executor.permit3(
            chainId,
            permit3.permitContract as UniversalAddress,
            permit3.owner as UniversalAddress,
            permit3.salt as Hex,
            Number(permit3.deadline),
            permit3.timestamp,
            chainPermits,
            merkleProof,
            permit3.signature as Hex,
          );

          span.setAttribute('permit3.tx_hash', permit3TxHash);
          this.logger.debug(`Permit3 executed on chain ${chainId}. TxHash: ${permit3TxHash}`);

          // Execute fundFor transactions (sequentially for each intent)
          const fundForTxHashes: Hex[] = [];
          for (const { quote, salt } of chainIntents) {
            // Convert quote to intent using QuotesService
            const intent = IntentDataSchema.parse(quote.intent);

            // Use the salt from the quote
            intent.route.salt = salt;

            const { routeHash } = PortalHashUtils.getIntentHash(intent);

            const chainType = ChainTypeDetector.detect(chainId);

            const fundForTxHash = await executor.fundFor(
              chainId,
              intent.destination,
              routeHash,
              intent.reward,
              allowPartial,
              AddressNormalizer.normalize(permit3.owner, chainType),
              AddressNormalizer.normalize(permit3.permitContract, chainType),
            );

            fundForTxHashes.push(fundForTxHash);
          }

          // For simplicity, return the last fundFor tx hash as the main transaction hash
          const transactionHash = fundForTxHashes[fundForTxHashes.length - 1];

          span.setAttributes({
            'fundFor.tx_count': fundForTxHashes.length,
            'fundFor.final_tx_hash': transactionHash,
          });

          this.logger.log(`Successfully executed transactions on chain ${chainId}`, {
            chainId,
            transactionHash,
            quoteIDs,
          });

          span.setStatus({ code: api.SpanStatusCode.OK });

          return {
            chainID: chainId,
            quoteIDs,
            transactionHash,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error(`Failed to execute transactions on chain ${chainId}: ${errorMessage}`);

          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });

          return {
            chainID: chainId,
            quoteIDs,
            error: error instanceof Error ? error.message : 'Unknown execution error',
          };
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Group permits by chain ID for Merkle tree construction
   */
  private groupPermitsByChain(
    permits: AllowanceOrTransfer[],
  ): Record<number, MerkleAllowanceOrTransfer[]> {
    const grouped: Record<number, MerkleAllowanceOrTransfer[]> = {};

    for (const permit of permits) {
      if (!grouped[permit.chainID]) {
        grouped[permit.chainID] = [];
      }

      grouped[permit.chainID].push({
        modeOrExpiration: permit.modeOrExpiration,
        tokenKey: permit.tokenKey as Hex,
        account: permit.account as Hex,
        amountDelta: permit.amountDelta,
      });
    }

    return grouped;
  }

  /**
   * Store gasless initiation metadata
   */
  private async storeInitiation(gaslessInitiationId: string, permit3: Permit3): Promise<void> {
    const initiation = new this.gaslessInitiationModel({
      gaslessInitiationId,
      permit3: {
        chainId: permit3.chainId,
        permitContract: permit3.permitContract,
        owner: permit3.owner,
        salt: permit3.salt,
        signature: permit3.signature,
        deadline: permit3.deadline.toString(),
        timestamp: permit3.timestamp,
        merkleRoot: permit3.merkleRoot,
        leaves: permit3.leaves,
        allowanceOrTransfers: permit3.allowanceOrTransfers.map((a) => ({
          chainID: a.chainID,
          modeOrExpiration: a.modeOrExpiration,
          tokenKey: a.tokenKey,
          account: a.account,
          amountDelta: a.amountDelta.toString(),
        })),
      },
    });

    await initiation.save();

    this.logger.debug('Stored gasless initiation metadata', { gaslessInitiationId });
  }
}
