import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { Hex } from 'viem';

import { EcoResponse } from '@/common/eco-response';
import { EcoLogMessage } from '@/common/logging/eco-log-message';
import { EcoLogger } from '@/common/logging/eco-logger';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { Permit3Validator } from '@/common/utils/permit3-validator';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';
import { AllowanceOrTransfer, StandardMerkleBuilder } from '@/common/utils/standard-merkle-builder';
import { EcoError } from '@/errors/eco-error';
import { GaslessIntentExecutionResponseDTO } from '@/modules/api/gasless-intents/dtos/gasless-intent-execution-response-dto.schema';
import { GaslessIntentExecutionResponseEntryDTO } from '@/modules/api/gasless-intents/dtos/gasless-intent-execution-response-entry-dto.schema';
import { GaslessIntentRequestDTO } from '@/modules/api/gasless-intents/dtos/gasless-intent-request-dto.schema';
import { AllowanceOrTransferDTO } from '@/modules/api/gasless-intents/dtos/permit3/allowance-or-transfer-dto.schema';
import { Permit3DTO } from '@/modules/api/gasless-intents/dtos/permit3/permit3-dto.schema';
import { GaslessInitiationIntentRepository } from '@/modules/api/gasless-intents/repositories/gasless-initiation-intent.repository';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { QuoteRepository } from '@/modules/intents/repositories/quote.repository';
import { IntentDataSchema } from '@/modules/intents/schemas/intent-data.schema';
import { Quote } from '@/modules/intents/schemas/quote.schema';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

/**
 * Service for handling gasless intent initiation
 * Orchestrates permit generation, transaction creation, and execution
 */
@Injectable()
export class GaslessIntentsService {
  private logger = new EcoLogger(GaslessIntentsService.name);
  private gaslessIntentdAppIDs: string[] = [];
  private readonly merkleBuilder = new StandardMerkleBuilder();

  constructor(
    private readonly gaslessInitiationIntentRepository: GaslessInitiationIntentRepository,
    private readonly quoteRepository: QuoteRepository,
    private readonly blockchainExecutor: BlockchainExecutorService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  /**
   * This function is used to initiate a gasless intent. It generates the permit transactions and fund transaction.
   * @param gaslessIntentRequestDTO
   * @returns
   */
  async initiateGaslessIntent(
    gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): Promise<EcoResponse<GaslessIntentExecutionResponseDTO>> {
    try {
      const { error } = this.checkGaslessIntentSupported(gaslessIntentRequestDTO.dAppID);

      if (error) {
        return { error };
      }

      return await this._initiateGaslessIntent(gaslessIntentRequestDTO);
    } catch (ex: any) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `initiateGaslessIntent: error`,
          properties: {
            error: ex.message,
          },
        }),
        ex.stack,
      );

      return { error: EcoError.GaslessIntentInitiationError };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private checkGaslessIntentSupported(dAppID: string): EcoResponse<void> {
    // if (!this.gaslessIntentdAppIDs.includes(dAppID)) {
    //   this.gaslessIntentdAppIDs.push(dAppID);

    //   this.logger.error(
    //     EcoLogMessage.fromDefault({
    //       message: `checkGaslessIntentSupported: dAppID: ${dAppID} not supported for gasless intents`,
    //     }),
    //   );

    //   return { error: EcoError.GaslessIntentsNotSupported };
    // }

    return {};
  }

  /**
   * This function is used to initiate a gasless intent. It generates the permit transactions and fund transaction.
   * @param gaslessIntentRequestDTO
   * @returns
   */
  async _initiateGaslessIntent(
    request: GaslessIntentRequestDTO,
  ): Promise<EcoResponse<GaslessIntentExecutionResponseDTO>> {
    return this.otelService.tracer.startActiveSpan(
      'gasless-intents.initiateGaslessIntent',
      {
        attributes: {
          'gasless.initiation_id': request.intentGroupID,
          'gasless.dapp_id': request.dAppID,
          'gasless.intent_count': request.intents.length,
          'gasless.permit_count': request.gaslessIntentData.permit3.allowanceOrTransfers.length,
          'gasless.quote_ids': JSON.stringify(request.intents.map((i) => i.quoteID)),
          'gasless.intents.salts': JSON.stringify(request.intents.map((i) => i.salt)),
          'gasless.permit_owner': request.gaslessIntentData.permit3.owner,
          'gasless.permit_deadline': request.gaslessIntentData.permit3.deadline.toString(),
          'gasless.permit_merkle_root': request.gaslessIntentData.permit3.merkleRoot,
          'gasless.allow_partial': request.gaslessIntentData.allowPartial ?? false,
        },
      },
      async (span) => {
        try {
          const { intentGroupID, dAppID, intents, gaslessIntentData } = request;

          this.logger.log(`Initiating gasless intent`, {
            intentGroupID,
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
          const merkleResult = await this.otelService.tracer.startActiveSpan(
            'gasless-intents.createMerkleProofs',
            {
              attributes: {
                'merkle.chain_count': Object.keys(permitsByChain).length,
                'merkle.total_permits': gaslessIntentData.permit3.allowanceOrTransfers.length,
                'merkle.permit_owner': gaslessIntentData.permit3.owner,
              },
            },
            (merkleSpan) => {
              try {
                const result = this.merkleBuilder.createCrossChainProofs(permitsByChain);

                if (result.error) {
                  merkleSpan.recordException(new Error(result.error.message));
                  merkleSpan.setStatus({ code: api.SpanStatusCode.ERROR });
                } else {
                  merkleSpan.setAttribute('merkle.merkle_root', result.response!.merkleRoot);
                  merkleSpan.setStatus({ code: api.SpanStatusCode.OK });
                }

                return result;
              } catch (error) {
                merkleSpan.recordException(error as Error);
                merkleSpan.setStatus({ code: api.SpanStatusCode.ERROR });
                throw error;
              } finally {
                merkleSpan.end();
              }
            },
          );

          const { response: crossChainProofs, error } = merkleResult;

          if (error) {
            this.logger.error(
              EcoLogMessage.fromDefault({
                message: `generateTxs: failed to create Merkle tree`,
                properties: {
                  error: error?.message,
                },
              }),
            );

            return { error: EcoError.PermitProofConstructionFailed };
          }

          const { merkleRoot, proofsByChainId } = crossChainProofs!;

          // Verify merkleRoot matches the one in the permit
          if (merkleRoot !== gaslessIntentData.permit3.merkleRoot) {
            return { error: EcoError.MerkleRootMismatch };
          }

          // Group intents by source chain
          const intentsByChain = await this.groupIntentsByChain(intents);

          // Add chain distribution attributes
          const chainIds = Array.from(intentsByChain.keys());
          const intentsPerChain: Record<number, number> = {};
          intentsByChain.forEach((chainIntents, chainId) => {
            intentsPerChain[chainId] = chainIntents.length;
          });

          span.setAttributes({
            'gasless.chain_ids': JSON.stringify(chainIds),
            'gasless.chain_count': chainIds.length,
            'gasless.intents_per_chain': JSON.stringify(intentsPerChain),
          });

          // Save the permit data to the database
          await this.otelService.tracer.startActiveSpan(
            'gasless-intents.saveInitiationIntent',
            {
              attributes: {
                initiation_id: intentGroupID,
              },
            },
            async (dbSpan) => {
              try {
                await this.gaslessInitiationIntentRepository.addIntent({
                  intentGroupID,
                  permit3: gaslessIntentData.permit3,
                });

                dbSpan.setStatus({ code: api.SpanStatusCode.OK });
              } catch (error) {
                dbSpan.recordException(error as Error);
                dbSpan.setStatus({ code: api.SpanStatusCode.ERROR });
                throw error;
              } finally {
                dbSpan.end();
              }
            },
          );

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
          const successes: GaslessIntentExecutionResponseEntryDTO[] = [];
          const failures: GaslessIntentExecutionResponseEntryDTO[] = [];

          for (const result of settledResults) {
            if (result.status === 'fulfilled') {
              const response = result.value;
              if (response.error) {
                failures.push(response);
              } else {
                successes.push(response);
              }
            } else {
              // Very rare edge case: the entire promise throws
              this.logger.error(
                EcoLogMessage.fromDefault({
                  message: `_initiateGaslessIntent: unexpected unhandled rejection: ${result.reason}`,
                }),
              );
            }
          }

          this.logger.log(`Gasless intent initiation completed`, {
            intentGroupID,
            successes: successes.length,
            failures: failures.length,
          });

          span.setAttributes({
            'gasless.success_count': successes.length,
            'gasless.failure_count': failures.length,
          });

          span.setStatus({ code: api.SpanStatusCode.OK });

          return {
            response: {
              successes,
              failures,
            },
          };
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
  private async validatePermit3(permit3: Permit3DTO): Promise<EcoResponse<void>> {
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
          const { error: permitValidationError } = await Permit3Validator.validatePermit({
            owner: permit3.owner as Hex,
            salt: permit3.salt as Hex,
            deadline: permit3.deadline,
            timestamp: permit3.timestamp,
            merkleRoot: permit3.merkleRoot as Hex,
            signature: permit3.signature as Hex,
            permitContract: permit3.permitContract as Hex,
          });

          if (permitValidationError) {
            this.logger.error(
              EcoLogMessage.fromDefault({
                message: `validatePermit3: permit validation failed`,
                properties: {
                  permit3,
                  error: permitValidationError,
                },
              }),
            );

            span.recordException(new Error(permitValidationError.message));
            span.setStatus({ code: api.SpanStatusCode.ERROR });
          } else {
            span.setStatus({ code: api.SpanStatusCode.OK });
          }
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }

        return {};
      },
    );
  }

  /**
   * Group intents by their source chain
   */
  private async groupIntentsByChain(intents: Array<{ quoteID: string; salt: string }>) {
    return this.otelService.tracer.startActiveSpan(
      'gasless-intents.groupIntentsByChain',
      {
        attributes: {
          intent_count: intents.length,
          'grouping.quote_ids': JSON.stringify(intents.map((i) => i.quoteID)),
        },
      },
      async (span) => {
        try {
          const intentsByChain = new Map<
            number,
            Array<{ quoteID: string; salt: Hex; quote: Quote }>
          >();

          for (const intent of intents) {
            const { quoteID, salt } = intent;

            // Fetch quote from database
            const quote = await this.quoteRepository.getByQuoteID(quoteID);
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

          // Build chains distribution string
          const distribution = Array.from(intentsByChain.entries())
            .map(([chainId, chainIntents]) => `${chainId}:${chainIntents.length}`)
            .join(',');

          span.setAttributes({
            chain_count: intentsByChain.size,
            'grouping.chains_distribution': distribution,
          });

          span.setStatus({ code: api.SpanStatusCode.OK });
          return intentsByChain;
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
   * Execute permit3 and fundFor transactions for a single chain
   */
  private async executeChainTransactions(
    chainId: number,
    chainIntents: Array<{ quoteID: string; salt: Hex; quote: Quote }>,
    permit3: Permit3DTO,
    merkleProof: Hex[],
    allowPartial: boolean,
  ): Promise<GaslessIntentExecutionResponseEntryDTO> {
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

          // Build permit3 params
          const permit3Params = {
            chainId,
            permitContract: permit3.permitContract as UniversalAddress,
            owner: permit3.owner as UniversalAddress,
            salt: permit3.salt as Hex,
            deadline: Number(permit3.deadline),
            timestamp: permit3.timestamp,
            permits: chainPermits,
            merkleProof,
            signature: permit3.signature as Hex,
          };

          // Build fundFor params for all intents on this chain
          const chainType = ChainTypeDetector.detect(chainId);
          const fundForCalls = chainIntents.map(({ quote, salt }) => {
            // Convert quote to intent using QuotesService
            const intent = IntentDataSchema.parse(quote.intent);

            // Use the salt from the quote
            intent.route.salt = salt;

            const { routeHash } = PortalHashUtils.getIntentHash(intent);

            this.logger.debug(
              EcoLogMessage.fromDefault({
                message: `executeChainTransactions`,
                properties: {
                  chainId,
                  destination: intent.destination,
                  routeHash,
                  reward: intent.reward,
                  allowPartial,
                  owner: permit3.owner,
                  permitContract: permit3.permitContract,
                },
              }),
            );

            return {
              chainId,
              destination: intent.destination,
              routeHash,
              reward: intent.reward,
              allowPartial,
              funder: AddressNormalizer.normalize(permit3.owner, chainType),
              permitContract: AddressNormalizer.normalize(permit3.permitContract, chainType),
            };
          });

          // Execute permit3 + multiple fundFor atomically in a single transaction
          const transactionHash = await executor.fundForWithPermit3(
            permit3Params,
            fundForCalls,
            'basic',
          );

          span.setAttributes({
            'batch.tx_hash': transactionHash,
            'batch.fundFor_count': fundForCalls.length,
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
    permits: AllowanceOrTransferDTO[],
  ): Record<number, AllowanceOrTransfer[]> {
    return this.otelService.tracer.startActiveSpan(
      'gasless-intents.groupPermitsByChain',
      {
        attributes: {
          permit_count: permits.length,
        },
      },
      (span) => {
        try {
          const grouped: Record<number, AllowanceOrTransfer[]> = {};

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

          span.setAttributes({
            chain_count: Object.keys(grouped).length,
          });

          span.setStatus({ code: api.SpanStatusCode.OK });
          return grouped;
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
}
