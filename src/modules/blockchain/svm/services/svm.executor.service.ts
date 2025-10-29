import { Injectable } from '@nestjs/common';

import { AnchorProvider, BN, Program, setProvider } from '@coral-xyz/anchor';
import * as api from '@opentelemetry/api';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  AccountMeta,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';

import {
  BaseChainExecutor,
  ExecutionResult,
} from '@/common/abstractions/base-chain-executor.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { ProverType, TProverType } from '@/common/interfaces/prover.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';
import { WalletType } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
import { portalIdl } from '@/modules/blockchain/svm/targets/idl/portal.idl';
import { PortalIdl } from '@/modules/blockchain/svm/targets/types/portal-idl.type';
import { toBuffer } from '@/modules/blockchain/svm/utils/buffer';
import {
  buildTokenTransferInstructions,
  decodeRouteCalls,
  getTokenAccounts,
} from '@/modules/blockchain/svm/utils/call-data';
import { quoteAndCreatePayForGasInstruction } from '@/modules/blockchain/svm/utils/igp';
import { toSvmRoute } from '@/modules/blockchain/svm/utils/instruments';
import { getTransferDestination } from '@/modules/blockchain/svm/utils/tokens';
import { getAnchorWallet } from '@/modules/blockchain/svm/utils/wallet-adapter';
import { BlockchainConfigService, SolanaConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { ProverService } from '@/modules/prover/prover.service';

import { HyperProverUtils } from '../utils/hyper-prover.utils';

import { SvmHyperProver } from './svm-hyper.prover';
import { SvmWalletManagerService, SvmWalletType } from './svm-wallet-manager.service';

@Injectable()
export class SvmExecutorService extends BaseChainExecutor {
  private readonly connection: Connection;
  private portalProgram: Program<PortalIdl> | null = null;
  private keypair: Keypair | null = null;
  private isInitialized = false;

  constructor(
    private solanaConfigService: SolanaConfigService,
    private blockchainConfigService: BlockchainConfigService,
    private readonly logger: SystemLoggerService,
    private walletManager: SvmWalletManagerService,
    private readonly otelService: OpenTelemetryService,
    private readonly proverService: ProverService,
    private readonly svmHyperProver: SvmHyperProver,
  ) {
    super();
    this.logger.setContext(SvmExecutorService.name);
    this.connection = new Connection(this.solanaConfigService.rpcUrl, 'confirmed');
  }

  async fulfill(intent: Intent, _walletId?: string): Promise<ExecutionResult> {
    return this.otelService.tracer.startActiveSpan(
      'svm.executor.fulfill',
      {
        attributes: {
          'svm.intent_hash': intent.intentHash,
          'svm.source_chain': intent.sourceChainId?.toString(),
          'svm.destination_chain': intent.destination.toString(),
          'svm.operation': 'fulfill',
          'svm.wallet_id': _walletId || 'default',
          'svm.route.tokens_count': intent.route.tokens.length,
          'svm.route.calls_count': intent.route.calls.length,
          'svm.route.native_amount': intent.route.nativeAmount.toString(),
        },
      },
      async (span) => {
        // Lazy initialization of Portal program
        if (!this.isInitialized) {
          span.addEvent('svm.fulfill.initialization_required');
          try {
            await this.initializeProgram();
            this.isInitialized = true;
            span.addEvent('svm.fulfill.initialization_completed');
          } catch (error) {
            this.logger.error(
              'Failed to initialize Portal program during fulfill:',
              toError(error),
            );
            span.recordException(toError(error));
            span.setStatus({ code: api.SpanStatusCode.ERROR });
            span.end();
            throw error;
          }
        }

        if (!this.portalProgram || !this.keypair) {
          const error = new Error('Portal program or keypair not properly initialized');
          span.recordException(error);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          span.end();
          throw error;
        }

        span.addEvent('svm.fulfill.started');

        try {
          // Step 1: Execute the fulfill transaction
          span.addEvent('svm.fulfill.fulfill_transaction.phase_started');

          const fulfillResult = await this.executeFulfillTransaction(intent, span);

          span.setAttribute('svm.fulfill_transaction.success', fulfillResult.success);

          if (!fulfillResult.success) {
            span.addEvent('svm.fulfill.fulfill_transaction.failed', {
              error: fulfillResult.error,
            });
            span.setAttribute('svm.fulfill.result', 'fulfill_failed');
            span.setStatus({ code: api.SpanStatusCode.ERROR });
            return fulfillResult;
          }

          span.addEvent('svm.fulfill.fulfill_transaction.phase_completed', {
            transaction_hash: fulfillResult.txHash,
          });

          this.logger.log(
            `Intent ${intent.intentHash} fulfilled with signature: ${fulfillResult.txHash}`,
          );

          // Step 2: Execute the prove transaction
          span.addEvent('svm.fulfill.prove_transaction.phase_started');

          const proveResult = await this.executeProveTransaction(intent, span);

          if (proveResult) {
            span.setAttribute('svm.prove_transaction.success', proveResult.success);

            if (!proveResult.success) {
              this.logger.error(
                `Prove transaction failed for intent ${intent.intentHash}: ${proveResult.error}`,
              );
              span.addEvent('svm.fulfill.prove_transaction.failed', {
                error: proveResult.error,
              });
            } else {
              this.logger.log(
                `Intent ${intent.intentHash} proved with signature: ${proveResult.txHash}`,
              );
              span.addEvent('svm.fulfill.prove_transaction.phase_completed', {
                transaction_hash: proveResult.txHash,
              });
              if (proveResult.txHash) {
                span.setAttribute('svm.prove_transaction_hash', proveResult.txHash);
              }
            }
          } else {
            span.addEvent('svm.fulfill.prove_transaction.skipped', {
              reason: 'no_prove_result',
            });
            span.setAttribute('svm.prove_transaction.skipped', true);
          }

          span.setAttributes({
            'svm.fulfill.result': 'success',
            'svm.fulfill_transaction_hash': fulfillResult.txHash,
          });

          span.addEvent('svm.fulfill.completed');
          span.addEvent('svm.transaction.confirmed');
          span.setStatus({ code: api.SpanStatusCode.OK });

          return {
            success: true,
            txHash: fulfillResult.txHash,
          };
        } catch (error) {
          const typedError = toError(error);

          this.logger.error('Solana execution error:', typedError);

          span.setAttributes({
            'svm.fulfill.result': 'error',
            'svm.error_type': typedError.constructor.name,
          });

          span.addEvent('svm.fulfill.error', {
            error_message: getErrorMessage(error),
          });

          span.recordException(typedError);
          span.setStatus({ code: api.SpanStatusCode.ERROR });

          return {
            success: false,
            error: getErrorMessage(error),
          };
        } finally {
          span.end();
        }
      },
    );
  }

  async getBalance(address: string, _chainId: number): Promise<bigint> {
    const publicKey = new PublicKey(address);
    const balance = await this.connection.getBalance(publicKey);
    return BigInt(balance);
  }

  async getWalletAddress(
    walletType: WalletType,
    chainId: bigint | number,
  ): Promise<UniversalAddress> {
    // Convert WalletType to SvmWalletType (currently only 'basic' is supported)
    const svmWalletType: SvmWalletType = walletType as SvmWalletType;
    return this.walletManager.getWalletAddress(Number(chainId), svmWalletType);
  }

  async isTransactionConfirmed(txHash: string, _chainId: number): Promise<boolean> {
    try {
      const status = await this.connection.getSignatureStatus(txHash);
      return (
        status.value?.confirmationStatus === 'confirmed' ||
        status.value?.confirmationStatus === 'finalized'
      );
    } catch {
      return false;
    }
  }

  /**
   * Execute batch withdrawal on Solana
   */
  async executeBatchWithdraw(
    chainId: bigint,
    withdrawalData: any,
    _walletId?: string,
  ): Promise<string> {
    return this.otelService.tracer.startActiveSpan(
      'svm.executor.batchWithdraw',
      {
        attributes: {
          'svm.chain_id': chainId.toString(),
          'svm.wallet_id': _walletId || 'default',
          'svm.operation': 'batchWithdraw',
          'svm.intent_count': withdrawalData.destinations?.length || 0,
          'svm.withdrawal_data.destinations_count': withdrawalData.destinations?.length || 0,
          'svm.withdrawal_data.route_hashes_count': withdrawalData.routeHashes?.length || 0,
          'svm.withdrawal_data.rewards_count': withdrawalData.rewards?.length || 0,
        },
      },
      async (span) => {
        try {
          // Add validation events
          span.addEvent('svm.batch_withdraw.validation.started');

          // Lazy initialization of Portal program
          if (!this.isInitialized) {
            span.addEvent('svm.batch_withdraw.initialization.started');
            await this.initializeProgram();
            this.isInitialized = true;
            span.addEvent('svm.batch_withdraw.initialization.completed');
          }

          if (!this.portalProgram || !this.keypair) {
            const error = new Error('Portal program or keypair not properly initialized');
            span.recordException(error);
            span.setStatus({ code: api.SpanStatusCode.ERROR });
            throw error;
          }

          span.addEvent('svm.batch_withdraw.validation.completed');

          this.logger.log(
            `Executing batch withdrawal for ${withdrawalData.destinations?.length || 0} intents on Solana (chain ${chainId})`,
          );

          // Add more detailed attributes
          span.setAttributes({
            'svm.destinations_count': withdrawalData.destinations?.length || 0,
            'svm.portal_program_id': this.portalProgram.programId.toString(),
            'svm.payer_address': this.keypair.publicKey.toString(),
          });

          // Track instruction generation phase
          span.addEvent('svm.batch_withdraw.instructions.generation.started');

          // Create withdrawal instructions for each intent
          const { withdrawalInstructions, ataCreationInstructions } =
            await this.createWithdrawalInstructions(withdrawalData);

          if (withdrawalInstructions.length === 0) {
            const error = new Error('No valid withdrawal instructions generated');
            span.recordException(error);
            span.setStatus({ code: api.SpanStatusCode.ERROR });
            throw error;
          }

          // Add instruction metrics
          span.setAttributes({
            'svm.instructions.withdrawal_count': withdrawalInstructions.length,
            'svm.instructions.ata_creation_count': ataCreationInstructions.length,
            'svm.instructions.total_count':
              withdrawalInstructions.length + ataCreationInstructions.length + 1, // +1 for compute budget
          });

          span.addEvent('svm.batch_withdraw.instructions.generation.completed', {
            withdrawal_instructions: withdrawalInstructions.length,
            ata_creation_instructions: ataCreationInstructions.length,
          });

          const computeUnits = Math.min(1_400_000, 500_000 * withdrawalInstructions.length);
          const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
            units: computeUnits,
          });

          span.setAttribute('svm.compute_units_requested', computeUnits);

          this.logger.log(
            `Creating transaction with ${ataCreationInstructions.length} ATA creation instructions and ${withdrawalInstructions.length} withdrawal instructions`,
          );

          // Track transaction creation
          span.addEvent('svm.batch_withdraw.transaction.creation.started');

          // Get recent blockhash for the transaction
          const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();

          const wallet = this.walletManager.getWallet();

          // Create and send transaction - compute budget instructions must be first, then ATA creations, then withdrawals
          const transaction = new Transaction({
            blockhash,
            lastValidBlockHeight,
            feePayer: wallet.getKeypair().publicKey,
          })
            .add(computeBudgetIx)
            .add(...ataCreationInstructions)
            .add(...withdrawalInstructions);

          span.addEvent('svm.batch_withdraw.transaction.creation.completed', {
            total_instructions: transaction.instructions.length,
            transaction_size_bytes: transaction.serialize({ requireAllSignatures: false }).length,
          });

          // Track transaction submission
          span.addEvent('svm.batch_withdraw.transaction.submission.started');

          const signature = await wallet.sendTransaction(transaction, {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          });

          // Add comprehensive success attributes
          span.setAttributes({
            'svm.batch_withdraw_signature': signature,
            'svm.transaction_success': true,
          });

          span.addEvent('svm.batch_withdraw.transaction.submitted', {
            signature,
            instructions_executed: transaction.instructions.length,
            ata_creations_executed: ataCreationInstructions.length,
            withdrawals_executed: withdrawalInstructions.length,
            compute_units_used: computeUnits,
          });

          this.logger.log(
            `Successfully executed batch withdrawal for ${withdrawalInstructions.length} intents with ${ataCreationInstructions.length} ATA creations. Signature: ${signature}`,
          );

          span.setStatus({ code: api.SpanStatusCode.OK });
          return signature;
        } catch (error) {
          const typedError = toError(error);

          // Enhanced error tracking
          span.setAttributes({
            'svm.transaction_success': false,
            'svm.error_type': typedError.constructor.name,
            'svm.error_stage': this.determineErrorStage(typedError),
          });

          span.addEvent('svm.batch_withdraw.error', {
            error_message: getErrorMessage(error),
            error_type: typedError.constructor.name,
            stage: this.determineErrorStage(typedError),
          });

          this.logger.error('Solana batch withdrawal error:', typedError);
          span.recordException(typedError);
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: getErrorMessage(error),
          });
          throw error;
        }
      },
    );
  }

  private async createWithdrawalInstructions(withdrawalData: any): Promise<{
    withdrawalInstructions: TransactionInstruction[];
    ataCreationInstructions: TransactionInstruction[];
  }> {
    // Check for active span from parent, use it if available
    const activeSpan = api.trace.getActiveSpan();
    if (activeSpan) {
      return this.createWithdrawalInstructionsWithSpan(withdrawalData, activeSpan);
    }

    return this.otelService.tracer.startActiveSpan(
      'svm.executor.batch_withdraw.create_instructions',
      {
        attributes: {
          'svm.operation': 'create_withdrawal_instructions',
          'svm.destinations_count': withdrawalData.destinations?.length || 0,
        },
      },
      async (span) => {
        try {
          const result = await this.createWithdrawalInstructionsWithSpan(withdrawalData, span);
          span.setStatus({ code: api.SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: getErrorMessage(error),
          });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  private async createWithdrawalInstructionsWithSpan(
    withdrawalData: any,
    span: api.Span,
  ): Promise<{
    withdrawalInstructions: TransactionInstruction[];
    ataCreationInstructions: TransactionInstruction[];
  }> {
    const withdrawalInstructions: TransactionInstruction[] = [];
    const ataCreationInstructions: TransactionInstruction[] = [];

    span.addEvent('svm.withdrawal_instructions.validation.started');

    if (!withdrawalData.destinations || !withdrawalData.routeHashes || !withdrawalData.rewards) {
      throw new Error(
        'Invalid withdrawal data structure: missing destinations, routeHashes, or rewards',
      );
    }

    const { destinations, routeHashes, rewards } = withdrawalData;

    if (destinations.length !== routeHashes.length || destinations.length !== rewards.length) {
      throw new Error(
        `Withdrawal data length mismatch: destinations=${destinations.length}, routeHashes=${routeHashes.length}, rewards=${rewards.length}`,
      );
    }

    span.setAttributes({
      'svm.total_withdrawals': destinations.length,
    });

    span.addEvent('svm.withdrawal_instructions.validation.completed', {
      total_withdrawals: destinations.length,
    });

    let successCount = 0;
    let failureCount = 0;

    span.addEvent('svm.withdrawal_instructions.loop.started');

    for (let i = 0; i < destinations.length; i++) {
      try {
        span.addEvent('svm.withdrawal_instructions.item.processing', {
          index: i,
          total: destinations.length,
        });

        const destination = BigInt(destinations[i]);
        const routeHash = routeHashes[i];
        const reward = rewards[i];

        this.logger.debug(
          `Processing withdrawal for destination: ${destination}, routeHash: ${routeHash}`,
        );
        const intentHashHex = PortalHashUtils.getIntentHash(
          destination,
          routeHash as `0x${string}`,
          PortalHashUtils.computeRewardHash(reward, destination),
        ).intentHash;

        const intentHashBuffer = toBuffer(intentHashHex);

        const configuredClaimant = this.blockchainConfigService.getClaimant(destination);
        const claimantPublicKey = new PublicKey(
          AddressNormalizer.denormalizeToSvm(configuredClaimant),
        );

        // Derive required PDAs matching the Rust implementation
        const [vaultPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('vault'), intentHashBuffer],
          this.portalProgram!.programId,
        );

        const [withdrawnMarkerPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('claimed_marker'), intentHashBuffer],
          this.portalProgram!.programId,
        );

        // Proof PDA includes both intent hash and prover address
        const [proofPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('proof'), intentHashBuffer],
          new PublicKey(AddressNormalizer.denormalizeToSvm(reward.prover)),
        );

        const [portalProofCloserPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('proof_closer')],
          this.portalProgram!.programId,
        );

        // Generate token account metas for withdrawal
        const { tokenAccountMetas, createATAInstructions } = await this.generateTokenAccountMetas(
          reward.tokens,
          vaultPDA,
          claimantPublicKey,
        );

        // Add create ATA instructions to the collection
        ataCreationInstructions.push(...createATAInstructions);

        // Convert reward data to proper format
        const rewardData = {
          deadline: new BN(reward.deadline.toString()),
          creator: new PublicKey(AddressNormalizer.denormalizeToSvm(reward.creator)),
          prover: new PublicKey(AddressNormalizer.denormalizeToSvm(reward.prover)),
          nativeAmount: new BN(reward.nativeAmount.toString()),
          tokens: reward.tokens.map((token: any) => ({
            token: new PublicKey(AddressNormalizer.denormalizeToSvm(token.token)),
            amount: new BN(token.amount.toString()),
          })),
        };

        this.logger.debug(`Reward creator: ${rewardData.creator.toString()}`);

        // Create withdraw instruction args
        const withdrawArgs = {
          destination: new BN(destination.toString()),
          routeHash: { 0: Array.from(toBuffer(routeHash)) },
          reward: rewardData,
        };

        const withdrawalIx = await this.portalProgram!.methods.withdraw(withdrawArgs)
          .accounts({
            payer: this.keypair!.publicKey,
            claimant: claimantPublicKey,
            vault: vaultPDA,
            proof: proofPDA,
            proofCloser: portalProofCloserPDA,
            prover: new PublicKey(AddressNormalizer.denormalizeToSvm(reward.prover)),
            withdrawnMarker: withdrawnMarkerPDA,
          })
          .remainingAccounts([
            ...tokenAccountMetas,
            {
              pubkey: this.getHyperProverPdaPayerPDA(reward.prover),
              isSigner: false,
              isWritable: true,
            },
          ])
          .instruction();

        withdrawalInstructions.push(withdrawalIx);
        successCount++;

        span.addEvent('svm.withdrawal_instructions.item.success', {
          index: i,
          intent_hash: intentHashHex,
          token_account_metas: tokenAccountMetas.length,
          ata_instructions_created: createATAInstructions.length,
        });

        this.logger.debug(
          `Created withdrawal instruction for intent hash: ${intentHashHex}, claimant: ${claimantPublicKey.toString()}`,
        );
      } catch (error) {
        failureCount++;
        this.logger.error(
          `Failed to create withdrawal instruction for intent ${i}: ${getErrorMessage(error)}`,
        );

        span.addEvent('svm.withdrawal_instructions.item.failure', {
          index: i,
          error: getErrorMessage(error),
        });

        // Continue with other intents rather than failing the entire batch
        continue;
      }
    }

    span.setAttributes({
      'svm.withdrawal_instructions.success_count': successCount,
      'svm.withdrawal_instructions.failure_count': failureCount,
      'svm.withdrawal_instructions.total_created': withdrawalInstructions.length,
      'svm.ata_instructions.total_created': ataCreationInstructions.length,
    });

    span.addEvent('svm.withdrawal_instructions.loop.completed', {
      success_count: successCount,
      failure_count: failureCount,
      withdrawal_instructions: withdrawalInstructions.length,
      ata_instructions: ataCreationInstructions.length,
    });

    return { withdrawalInstructions, ataCreationInstructions };
  }

  private async generateTokenAccountMetas(
    tokens: any[],
    vaultPDA: PublicKey,
    claimantPublicKey: PublicKey,
  ): Promise<{
    tokenAccountMetas: AccountMeta[];
    createATAInstructions: TransactionInstruction[];
  }> {
    // Check for active span from parent, use it if available
    const activeSpan = api.trace.getActiveSpan();
    if (activeSpan) {
      return this.generateTokenAccountMetasWithSpan(
        tokens,
        vaultPDA,
        claimantPublicKey,
        activeSpan,
      );
    }

    return this.otelService.tracer.startActiveSpan(
      'svm.executor.batch_withdraw.generate_token_accounts',
      {
        attributes: {
          'svm.operation': 'generate_token_account_metas',
          'svm.tokens_count': tokens.length,
        },
      },
      async (span) => {
        try {
          const result = await this.generateTokenAccountMetasWithSpan(
            tokens,
            vaultPDA,
            claimantPublicKey,
            span,
          );
          span.setStatus({ code: api.SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: getErrorMessage(error),
          });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  private async generateTokenAccountMetasWithSpan(
    tokens: any[],
    vaultPDA: PublicKey,
    claimantPublicKey: PublicKey,
    span: api.Span,
  ): Promise<{
    tokenAccountMetas: AccountMeta[];
    createATAInstructions: TransactionInstruction[];
  }> {
    const tokenAccountMetas: AccountMeta[] = [];
    const createATAInstructions: TransactionInstruction[] = [];

    span.setAttributes({
      'svm.vault_pda': vaultPDA.toString(),
      'svm.claimant_address': claimantPublicKey.toString(),
    });

    span.addEvent('svm.token_accounts.generation.started', {
      tokens_count: tokens.length,
    });

    let ataCreationCount = 0;
    let ataCheckErrors = 0;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      span.addEvent('svm.token_accounts.token_processing.started', {
        index: i,
        total: tokens.length,
      });

      const mintPublicKey = new PublicKey(AddressNormalizer.denormalizeToSvm(token.token));

      // Calculate vault ATA
      const vaultATA = await this.getAssociatedTokenAddress(
        mintPublicKey,
        vaultPDA,
        TOKEN_PROGRAM_ID,
      );

      // Calculate claimant ATA
      const claimantATA = await this.getAssociatedTokenAddress(
        mintPublicKey,
        claimantPublicKey,
        TOKEN_PROGRAM_ID,
      );

      // Check if ATAs exist and create them if they don't
      try {
        const claimantATAInfo = await this.connection.getAccountInfo(claimantATA);
        if (!claimantATAInfo) {
          // Create ATA instruction for claimant
          const createATAIx = createAssociatedTokenAccountInstruction(
            this.keypair!.publicKey,
            claimantATA,
            claimantPublicKey,
            mintPublicKey,
          );
          createATAInstructions.push(createATAIx);
          ataCreationCount++;

          this.logger.debug(`Will create ATA for claimant: ${claimantATA.toString()}`);

          span.addEvent('svm.token_accounts.ata_creation_scheduled', {
            index: i,
            mint: mintPublicKey.toString(),
            claimant_ata: claimantATA.toString(),
          });
        }
      } catch (error) {
        ataCheckErrors++;
        this.logger.warn(`Could not check claimant ATA ${claimantATA.toString()}: ${error}`);

        span.addEvent('svm.token_accounts.ata_check_error', {
          index: i,
          claimant_ata: claimantATA.toString(),
          error: getErrorMessage(error),
        });
      }

      // Add the three required accounts per token (vault ATA, claimant ATA, mint)
      tokenAccountMetas.push(
        {
          pubkey: vaultATA,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: claimantATA,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: mintPublicKey,
          isSigner: false,
          isWritable: false,
        },
      );

      span.addEvent('svm.token_accounts.token_processing.completed', {
        index: i,
        vault_ata: vaultATA.toString(),
        claimant_ata: claimantATA.toString(),
        mint: mintPublicKey.toString(),
        accounts_added: 3,
      });
    }

    span.setAttributes({
      'svm.token_account_metas_count': tokenAccountMetas.length,
      'svm.ata_instructions_count': createATAInstructions.length,
      'svm.ata_creation_count': ataCreationCount,
      'svm.ata_check_errors': ataCheckErrors,
    });

    span.addEvent('svm.token_accounts.generation.completed', {
      token_account_metas: tokenAccountMetas.length,
      ata_instructions: createATAInstructions.length,
      ata_creations: ataCreationCount,
      ata_check_errors: ataCheckErrors,
    });

    return { tokenAccountMetas, createATAInstructions };
  }

  private async getAssociatedTokenAddress(
    mint: PublicKey,
    owner: PublicKey,
    tokenProgram: PublicKey,
  ): Promise<PublicKey> {
    const [ata] = PublicKey.findProgramAddressSync(
      [owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    return ata;
  }

  private getHyperProverPdaPayerPDA(proverAddress: UniversalAddress): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('pda_payer')],
      new PublicKey(AddressNormalizer.denormalizeToSvm(proverAddress)),
    );
    return pda;
  }

  private async generateFulfillIx(intent: Intent) {
    // Check for active span, use it if available, otherwise create a new one
    const activeSpan = api.trace.getActiveSpan();
    if (activeSpan) {
      return this.generateFulfillIxWithSpan(intent, activeSpan);
    }

    return this.otelService.tracer.startActiveSpan(
      'svm.executor.fulfill.generate_instruction',
      {
        attributes: {
          'svm.intent_hash': intent.intentHash,
          'svm.operation': 'generate_fulfill_instruction',
        },
      },
      async (span) => {
        try {
          const result = await this.generateFulfillIxWithSpan(intent, span);
          span.setStatus({ code: api.SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: getErrorMessage(error),
          });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  private async generateFulfillIxWithSpan(intent: Intent, span: api.Span) {
    if (!this.portalProgram || !this.keypair) {
      throw new Error('Portal program not initialized');
    }

    span.addEvent('svm.fulfill.token_accounts.generation.started');

    const tokenAccounts = await getTokenAccounts(
      intent.route,
      this.keypair,
      this.portalProgram.idl.address,
    );

    span.setAttributes({
      'svm.token_accounts_count': tokenAccounts.length,
    });

    span.addEvent('svm.fulfill.token_accounts.generation.completed', {
      token_accounts: tokenAccounts.length,
    });

    // Construct calls
    span.addEvent('svm.fulfill.calls.decoding.started');

    const calls = decodeRouteCalls(intent.route.calls);
    const callAccounts = calls.map((call) => call.accounts).flat();

    const recipients = calls.map(
      (call) => getTransferDestination(call.calldata.data, call.accounts).pubkey,
    );

    span.setAttributes({
      'svm.calls_count': calls.length,
      'svm.call_accounts_count': callAccounts.length,
      'svm.recipients_count': recipients.length,
    });

    span.addEvent('svm.fulfill.calls.decoding.completed', {
      calls: calls.length,
      call_accounts: callAccounts.length,
      recipients: recipients.length,
    });

    // Get Token Instructions
    span.addEvent('svm.fulfill.transfer_instructions.building.started');

    const wallet = this.walletManager.getWallet();
    const walletAddress = await wallet.getAddress();

    const transferInstructions = await buildTokenTransferInstructions(
      intent.route.tokens,
      this.connection,
      walletAddress,
      recipients,
    );

    span.setAttributes({
      'svm.transfer_instructions_count': transferInstructions.length,
      'svm.wallet_address': walletAddress.toString(),
    });

    span.addEvent('svm.fulfill.transfer_instructions.building.completed', {
      transfer_instructions: transferInstructions.length,
    });

    // Calculate hashes
    span.addEvent('svm.fulfill.hashes.calculation.started');

    const { intentHash, rewardHash } = PortalHashUtils.getIntentHash(intent);
    const intentHashBuffer = toBuffer(intentHash);
    const rewardHashBytes = toBuffer(rewardHash);

    span.addEvent('svm.fulfill.hashes.calculation.completed');

    // Get claimant from configuration
    span.addEvent('svm.fulfill.pda_derivation.started');

    const configuredClaimant = this.blockchainConfigService.getClaimant(intent.sourceChainId);
    const claimantPublicKey = new PublicKey(AddressNormalizer.denormalizeToSvm(configuredClaimant));
    const claimantBytes32 = new Uint8Array(32);
    claimantBytes32.set(claimantPublicKey.toBytes());

    span.setAttribute('svm.claimant_address', claimantPublicKey.toString());

    const [fulfillMarkerPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('fulfill_marker'), intentHashBuffer],
      this.portalProgram.programId,
    );

    const [executorPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('executor')],
      this.portalProgram.programId,
    );

    span.setAttributes({
      'svm.fulfill_marker_pda': fulfillMarkerPDA.toString(),
      'svm.executor_pda': executorPDA.toString(),
    });

    span.addEvent('svm.fulfill.pda_derivation.completed');

    // Prepare route data for the instruction
    span.addEvent('svm.fulfill.instruction_building.started');

    const svmRoute: Intent['route'] = {
      ...intent.route,
      calls: calls.map((call) => call.routeCall),
    };

    const fulfillArgs = {
      intentHash: { 0: Array.from(intentHashBuffer) }, // Bytes32 format
      route: toSvmRoute(svmRoute),
      rewardHash: { 0: Array.from(rewardHashBytes) }, // Bytes32 format
      claimant: { 0: Array.from(claimantBytes32) }, // Bytes32 format
    };

    // Build the fulfill instruction matching the Rust accounts structure
    const fulfillmentIx = await this.portalProgram.methods
      .fulfill(fulfillArgs)
      .accounts({
        payer: this.keypair.publicKey,
        solver: this.keypair.publicKey,
        executor: executorPDA,
        fulfillMarker: fulfillMarkerPDA,
      })
      .remainingAccounts([...tokenAccounts, ...callAccounts])
      .instruction();

    const totalRemainingAccounts = tokenAccounts.length + callAccounts.length;

    span.setAttributes({
      'svm.total_remaining_accounts': totalRemainingAccounts,
      'svm.portal_program_id': this.portalProgram.programId.toString(),
    });

    span.addEvent('svm.fulfill.instruction_building.completed', {
      total_remaining_accounts: totalRemainingAccounts,
    });

    return { fulfillmentIx, transferInstructions };
  }

  private async executeFulfillTransaction(
    intent: Intent,
    span: api.Span,
  ): Promise<ExecutionResult> {
    return this.otelService.tracer.startActiveSpan(
      'svm.executor.fulfill.execute_transaction',
      {
        attributes: {
          'svm.intent_hash': intent.intentHash,
          'svm.operation': 'execute_fulfill_transaction',
        },
      },
      async (txSpan) => {
        try {
          const computeUnits = 600_000;

          txSpan.addEvent('svm.fulfill.instruction_generation.started');

          // Add compute budget instruction for fulfill transaction
          const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
            units: computeUnits,
          });

          // Generate the fulfillment instruction for the Portal program
          const { fulfillmentIx, transferInstructions } = await this.generateFulfillIx(intent);

          txSpan.setAttributes({
            'svm.transfer_instruction_count': transferInstructions.length,
            'svm.compute_units': computeUnits,
          });

          span.setAttribute('svm.transfer_instruction_count', transferInstructions.length);

          txSpan.addEvent('svm.fulfill.instruction_generation.completed', {
            transfer_instructions: transferInstructions.length,
          });

          txSpan.addEvent('svm.fulfill.transaction_build.started');

          // Get recent blockhash for the transaction
          const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();

          const wallet = this.walletManager.getWallet();
          const transaction = new Transaction({
            blockhash,
            lastValidBlockHeight,
            feePayer: wallet.getKeypair().publicKey,
          })
            .add(computeBudgetIx)
            .add(...transferInstructions)
            .add(fulfillmentIx);

          const totalInstructions = 1 + transferInstructions.length + 1;

          txSpan.setAttributes({
            'svm.transaction.instruction_count': totalInstructions,
            'svm.transaction.size_bytes': transaction.serialize({ requireAllSignatures: false })
              .length,
          });

          txSpan.addEvent('svm.fulfill.transaction_build.completed', {
            total_instructions: totalInstructions,
          });

          span.addEvent('svm.fulfill_transaction.submitting', {
            instruction_count: totalInstructions,
            compute_unit_limit: computeUnits,
          });

          txSpan.addEvent('svm.fulfill.transaction_submission.started');

          // Send transaction (wallet already retrieved above for feePayer)
          const signature = await wallet.sendTransaction(transaction, {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          });

          txSpan.setAttributes({
            'svm.transaction_signature': signature,
            'svm.transaction_success': true,
          });

          span.setAttribute('svm.fulfill_transaction_signature', signature);
          span.addEvent('svm.fulfill_transaction.submitted');

          txSpan.addEvent('svm.fulfill.transaction_submission.completed', {
            signature,
          });

          txSpan.setStatus({ code: api.SpanStatusCode.OK });

          return {
            success: true,
            txHash: signature,
          };
        } catch (error) {
          const typedError = toError(error);
          this.logger.error(
            `Failed to execute fulfill transaction for intent ${intent.intentHash}:`,
            typedError,
          );

          txSpan.recordException(typedError);
          txSpan.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: getErrorMessage(error),
          });

          return {
            success: false,
            error: getErrorMessage(error),
          };
        } finally {
          txSpan.end();
        }
      },
    );
  }

  private async executeProveTransaction(
    intent: Intent,
    span: api.Span,
  ): Promise<ExecutionResult | null> {
    return this.otelService.tracer.startActiveSpan(
      'svm.executor.prove.execute_transaction',
      {
        attributes: {
          'svm.intent_hash': intent.intentHash,
          'svm.operation': 'execute_prove_transaction',
        },
      },
      async (txSpan) => {
        try {
          txSpan.addEvent('svm.prove.instruction_generation.started');

          const proveResult = await this.generateProveIx(intent);

          if (!proveResult) {
            this.logger.debug(
              `No prove instruction generated for intent ${intent.intentHash}, skipping prove transaction`,
            );
            txSpan.addEvent('svm.prove.skipped', {
              reason: 'no_prove_instruction',
            });
            txSpan.setStatus({ code: api.SpanStatusCode.OK });
            txSpan.end();
            return null;
          }

          txSpan.setAttributes({
            'svm.prove.additional_signers': proveResult.signers.length,
          });

          txSpan.addEvent('svm.prove.instruction_generation.completed', {
            additional_signers: proveResult.signers.length,
          });

          const computeUnits = 400_000;
          const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
            units: computeUnits,
          });

          txSpan.setAttribute('svm.compute_units', computeUnits);

          txSpan.addEvent('svm.prove.transaction_build.started');

          const { blockhash } = await this.connection.getLatestBlockhash();

          const messageV0 = new TransactionMessage({
            payerKey: this.walletManager.getWallet().getKeypair().publicKey,
            recentBlockhash: blockhash,
            instructions: [computeBudgetIx, proveResult.instruction],
          }).compileToV0Message();
          const versionedTx = new VersionedTransaction(messageV0);

          // sign with wallet keypair first
          const wallet = this.walletManager.getWallet();
          versionedTx.sign([wallet.getKeypair()]);

          // sign with additional signers (unique message keypair)
          versionedTx.sign(proveResult.signers);

          txSpan.setAttributes({
            'svm.transaction.instruction_count': 2,
            'svm.transaction.total_signers': 1 + proveResult.signers.length,
          });

          txSpan.addEvent('svm.prove.transaction_build.completed', {
            instruction_count: 2,
            total_signers: 1 + proveResult.signers.length,
          });

          span.addEvent('svm.prove_transaction.submitting', {
            instruction_count: 2,
            compute_unit_limit: computeUnits,
            additional_signers: proveResult.signers.length,
          });

          txSpan.addEvent('svm.prove.transaction_submission.started');

          const signature = await this.connection.sendTransaction(versionedTx, {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          });

          txSpan.setAttribute('svm.transaction_signature', signature);
          txSpan.addEvent('svm.prove.transaction_submitted', { signature });

          txSpan.addEvent('svm.prove.transaction_confirmation.started');

          await this.connection.confirmTransaction(signature, 'confirmed');

          txSpan.setAttributes({
            'svm.transaction_success': true,
          });

          span.setAttribute('svm.prove_transaction_signature', signature);
          span.addEvent('svm.prove_transaction.submitted');

          txSpan.addEvent('svm.prove.transaction_confirmation.completed');

          // Parse the message ID from the transaction logs
          const messageId = await this.parseMessageIdFromTransaction(signature);
          if (messageId) {
            const messageIdHex = Buffer.from(messageId).toString('hex');
            txSpan.setAttribute('svm.message_id', messageIdHex);

            const gasPaymentResult = await this.payForGasForProve(intent, messageId, span);

            txSpan.setAttribute('svm.gas_payment_amount', gasPaymentResult.toString());

            this.logger.log(
              `Gas payment result for intent ${intent.intentHash} with message id: 0x${messageIdHex}, payment amount: ${gasPaymentResult}`,
            );
          } else {
            const errorMessage = `Could not parse message ID from prove transaction ${signature} for intent ${intent.intentHash}`;

            txSpan.addEvent('svm.prove.message_id_parse_failed', {
              transaction_signature: signature,
            });

            span.addEvent('svm.prove_transaction.message_id_parse_failed', {
              transaction_signature: signature,
              intent_hash: intent.intentHash,
              error: errorMessage,
            });

            txSpan.recordException(new Error(errorMessage));
            txSpan.setStatus({
              code: api.SpanStatusCode.ERROR,
              message: errorMessage,
            });

            span.setStatus({
              code: api.SpanStatusCode.ERROR,
              message: errorMessage,
            });

            txSpan.end();
            throw new Error(errorMessage);
          }

          txSpan.setStatus({ code: api.SpanStatusCode.OK });

          return {
            success: true,
            txHash: signature,
          };
        } catch (error) {
          const typedError = toError(error);
          this.logger.error(
            `Failed to execute prove transaction for intent ${intent.intentHash}:`,
            typedError,
          );

          txSpan.recordException(typedError);
          txSpan.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: getErrorMessage(error),
          });

          return {
            success: false,
            error: getErrorMessage(error),
          };
        } finally {
          txSpan.end();
        }
      },
    );
  }

  private async generateProveIx(
    intent: Intent,
  ): Promise<{ instruction: TransactionInstruction; signers: Keypair[] } | null> {
    // Check for active span, use it if available, otherwise create a new one
    const activeSpan = api.trace.getActiveSpan();
    if (activeSpan) {
      return this.generateProveIxWithSpan(intent, activeSpan);
    }

    return this.otelService.tracer.startActiveSpan(
      'svm.executor.prove.generate_instruction',
      {
        attributes: {
          'svm.intent_hash': intent.intentHash,
          'svm.operation': 'generate_prove_instruction',
        },
      },
      async (span) => {
        try {
          const result = await this.generateProveIxWithSpan(intent, span);
          if (result) {
            span.setStatus({ code: api.SpanStatusCode.OK });
          } else {
            span.setStatus({ code: api.SpanStatusCode.OK });
            span.addEvent('svm.prove.instruction_skipped');
          }
          return result;
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: getErrorMessage(error),
          });
          return null;
        } finally {
          span.end();
        }
      },
    );
  }

  private async generateProveIxWithSpan(
    intent: Intent,
    span: api.Span,
  ): Promise<{ instruction: TransactionInstruction; signers: Keypair[] } | null> {
    try {
      // Get the base prover to determine the type
      span.addEvent('svm.prove.prover_lookup.started');

      const sourceChainId = Number(intent.sourceChainId);
      const baseProver = this.proverService.getProver(sourceChainId, intent.reward.prover);

      if (!this.portalProgram) {
        throw new Error('Portal program not initialized');
      }

      if (!baseProver) {
        this.logger.warn(
          `No prover found for intent ${intent.intentHash}, skipping prove instruction`,
        );
        span.addEvent('svm.prove.prover_not_found', {
          source_chain_id: sourceChainId,
          prover_address: intent.reward.prover.toString(),
        });
        span.setAttribute('svm.prove.skip_reason', 'prover_not_found');
        return null;
      }

      span.setAttributes({
        'svm.prover_type': baseProver.type,
        'svm.source_chain_id': sourceChainId,
      });

      span.addEvent('svm.prove.prover_lookup.completed', {
        prover_type: baseProver.type,
      });

      // Check if this is a HyperProver (the only one with SVM support)
      if (baseProver.type !== ProverType.HYPER) {
        this.logger.warn(
          `Prover type ${baseProver.type} does not have SVM support for intent ${intent.intentHash}, skipping prove instruction`,
        );
        span.addEvent('svm.prove.unsupported_prover_type', {
          prover_type: baseProver.type,
        });
        span.setAttribute('svm.prove.skip_reason', 'unsupported_prover_type');
        span.setAttribute('svm.prove.svm_support', false);
        return null;
      }

      span.setAttribute('svm.prove.svm_support', true);

      const destinationChainId = Number(intent.destination);

      span.addEvent('svm.prove.prover_address_lookup.started');

      const proverAddress = this.blockchainConfigService.getProverAddress(
        destinationChainId,
        baseProver.type as TProverType,
      );

      if (!proverAddress) {
        this.logger.warn(
          `No prover address configured for ${baseProver.type} on chain ${destinationChainId}, skipping prove instruction`,
        );
        span.addEvent('svm.prove.prover_address_not_configured', {
          prover_type: baseProver.type,
          destination_chain_id: destinationChainId,
        });
        span.setAttribute('svm.prove.skip_reason', 'prover_address_not_configured');
        return null;
      }

      span.setAttributes({
        'svm.destination_chain_id': destinationChainId,
        'svm.prover_address': proverAddress.toString(),
      });

      span.addEvent('svm.prove.prover_address_lookup.completed');

      // Calculate intent hash
      span.addEvent('svm.prove.pda_derivation.started');

      const { intentHash } = PortalHashUtils.getIntentHash(intent);
      const intentHashBuffer = toBuffer(intentHash);

      const [fulfillMarkerPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('fulfill_marker'), intentHashBuffer],
        this.portalProgram.programId,
      );
      const [dispatcherPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('dispatcher')],
        this.portalProgram.programId,
      );

      span.setAttributes({
        'svm.fulfill_marker_pda': fulfillMarkerPDA.toString(),
        'svm.dispatcher_pda': dispatcherPDA.toString(),
      });

      span.addEvent('svm.prove.pda_derivation.completed');

      // Create the context for SVM prove instruction generation
      span.addEvent('svm.prove.context_creation.started');

      const context = {
        portalProgram: this.portalProgram,
        keypair: this.keypair!,
        proverAddress,
        intentHash: intentHashBuffer,
        fulfillMarkerPDA,
        dispatcherPDA,
      };

      span.addEvent('svm.prove.context_creation.completed');

      // Use the SVM HyperProver to generate the instruction
      span.addEvent('svm.prove.instruction_generation.started');

      const result = await this.svmHyperProver.generateSvmProveInstruction(intent, context);

      if (result) {
        this.logger.debug(
          `Generated prove instruction for intent ${intent.intentHash} with prover ${baseProver.type}`,
        );

        span.setAttributes({
          'svm.prove.instruction_generated': true,
          'svm.prove.signers_count': result.signers.length,
        });

        span.addEvent('svm.prove.instruction_generation.completed', {
          signers_count: result.signers.length,
        });
      } else {
        span.setAttribute('svm.prove.instruction_generated', false);
        span.addEvent('svm.prove.instruction_generation.returned_null');
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to generate prove instruction for intent ${intent.intentHash}:`,
        toError(error),
      );
      span.recordException(toError(error));
      return null;
    }
  }

  private async parseMessageIdFromTransaction(signature: string): Promise<Uint8Array | null> {
    // Check for active span from parent, use it if available
    const activeSpan = api.trace.getActiveSpan();
    if (activeSpan) {
      return this.parseMessageIdFromTransactionWithSpan(signature, activeSpan);
    }

    return this.otelService.tracer.startActiveSpan(
      'svm.executor.prove.parse_message_id',
      {
        attributes: {
          'svm.operation': 'parse_message_id',
          'svm.transaction_signature': signature,
        },
      },
      async (span) => {
        try {
          const result = await this.parseMessageIdFromTransactionWithSpan(signature, span);
          if (result) {
            span.setStatus({ code: api.SpanStatusCode.OK });
          } else {
            span.setStatus({ code: api.SpanStatusCode.OK });
            span.addEvent('svm.parse_message_id.not_found');
          }
          return result;
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: getErrorMessage(error),
          });
          return null;
        } finally {
          span.end();
        }
      },
    );
  }

  private async parseMessageIdFromTransactionWithSpan(
    signature: string,
    span: api.Span,
  ): Promise<Uint8Array | null> {
    try {
      span.addEvent('svm.parse_message_id.started');

      const messageId = await HyperProverUtils.parseMessageIdFromTransaction(
        this.connection,
        signature,
      );

      if (!messageId) {
        this.logger.warn(`Could not parse message ID from transaction ${signature}`);

        span.addEvent('svm.parse_message_id.not_found', {
          transaction_signature: signature,
        });

        span.setAttribute('svm.message_id_found', false);

        return null;
      }

      const messageIdHex = Buffer.from(messageId).toString('hex');

      span.setAttributes({
        'svm.message_id': messageIdHex,
        'svm.message_id_found': true,
        'svm.message_id_length': messageId.length,
      });

      span.addEvent('svm.parse_message_id.completed', {
        message_id: messageIdHex,
      });

      this.logger.debug(`Parsed message ID from transaction ${signature}: 0x${messageIdHex}`);

      return messageId;
    } catch (error) {
      this.logger.error(
        `Failed to parse message ID from transaction ${signature}: ${getErrorMessage(error)}`,
      );

      span.recordException(toError(error));
      span.addEvent('svm.parse_message_id.error', {
        error: getErrorMessage(error),
      });

      return null;
    }
  }

  private async payForGasForProve(
    intent: Intent,
    messageId: Uint8Array,
    span: api.Span,
  ): Promise<bigint> {
    return this.otelService.tracer.startActiveSpan(
      'svm.executor.payForGasForProve',
      {
        attributes: {
          'svm.intent_hash': intent.intentHash,
          'svm.source_chain': intent.sourceChainId?.toString(),
          'svm.destination_chain': intent.destination.toString(),
          'svm.message_id': Buffer.from(messageId).toString('hex'),
          'svm.operation': 'payForGas',
        },
      },
      async (gasPaymentSpan) => {
        try {
          const hyperlaneConfig = {
            hyperlaneMailbox: this.solanaConfigService.hyperlane?.mailbox,
            noop: this.solanaConfigService.hyperlane?.noop,
            igpProgram: this.solanaConfigService.hyperlane?.igpProgram,
            igpAccount: this.solanaConfigService.hyperlane?.igpAccount,
            overheadIgpAccount: this.solanaConfigService.hyperlane?.overheadIgpAccount,
          };

          const igpProgramId = HyperProverUtils.getIgpProgram(hyperlaneConfig);
          const igpAccount = HyperProverUtils.getIgpAccount(hyperlaneConfig);
          const overheadIgpAccount = HyperProverUtils.getOverheadIgpAccount(hyperlaneConfig);

          if (!igpProgramId || !igpAccount) {
            this.logger.warn(
              `IGP not configured for Solana, skipping gas payment for intent ${intent.intentHash}`,
            );
            gasPaymentSpan.recordException(new Error('IGP not configured'));
            gasPaymentSpan.setStatus({
              code: api.SpanStatusCode.ERROR,
              message: 'IGP not configured',
            });
            gasPaymentSpan.end();
            return BigInt(0);
          }

          const destinationDomain = Number(intent.sourceChainId);
          const gasAmount = BigInt(130000); // fixed gas amount for now

          gasPaymentSpan.addEvent('svm.gas_payment.processing', {
            destination_domain: destinationDomain,
            gas_amount: gasAmount.toString(),
            igp_program_id: igpProgramId.toString(),
            igp_account: igpAccount.toString(),
            overhead_igp_account: overheadIgpAccount.toString(),
            message_id: Buffer.from(messageId).toString('hex'),
          });

          const wallet = this.walletManager.getWallet();
          const payer = wallet.getKeypair().publicKey;

          const {
            instruction: payForGasInstruction,
            quotedAmount,
            uniqueGasPaymentKeypair,
            gasPaymentPDA,
          } = await quoteAndCreatePayForGasInstruction(
            this.connection,
            igpProgramId,
            payer,
            igpAccount,
            overheadIgpAccount,
            messageId,
            destinationDomain,
            gasAmount,
            payer,
          );

          gasPaymentSpan.setAttribute('svm.gas_payment.quoted_amount', quotedAmount.toString());
          gasPaymentSpan.setAttribute('svm.gas_payment.pda', gasPaymentPDA.toString());
          gasPaymentSpan.addEvent('svm.gas_payment.quoted');

          const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
          const payForGasTransaction = new Transaction({
            blockhash,
            lastValidBlockHeight,
            feePayer: payer,
          });

          const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
            units: 300_000,
          });

          payForGasTransaction.add(computeBudgetIx);
          payForGasTransaction.add(payForGasInstruction);

          // Sign the transaction with both wallet keypair and unique gas payment keypair
          payForGasTransaction.sign(wallet.getKeypair(), uniqueGasPaymentKeypair);

          span.addEvent('svm.gas_payment.submitting', {
            quoted_amount: quotedAmount.toString(),
            instruction_count: 2, // compute budget + pay for gas
            signatures_count: payForGasTransaction.signatures.length,
            signers: [payer.toString(), uniqueGasPaymentKeypair.publicKey.toString()],
          });

          let signature: string;
          try {
            signature = await this.connection.sendRawTransaction(payForGasTransaction.serialize(), {
              skipPreflight: false,
              preflightCommitment: 'confirmed',
            });
          } catch (sendError) {
            throw new Error(`Failed to send transaction: ${getErrorMessage(sendError)}`);
          }

          // Wait for confirmation
          try {
            await this.connection.confirmTransaction(signature, 'confirmed');
          } catch (confirmError) {
            this.logger.warn(`Gas payment transaction sent but confirmation failed: ${signature}`);
          }

          gasPaymentSpan.setAttribute('svm.gas_payment.transaction_signature', signature);
          gasPaymentSpan.addEvent('svm.gas_payment.confirmed');

          this.logger.log(
            `Gas payment completed for intent ${intent.intentHash}: paid ${quotedAmount} lamports for ${gasAmount} gas to domain ${destinationDomain}. Tx: ${signature}`,
          );

          return quotedAmount;
        } catch (error) {
          this.logger.warn(
            `Failed to pay for gas for intent ${intent.intentHash}: ${getErrorMessage(error)}. Continuing without payment.`,
          );
          span.addEvent('svm.gas_payment.failed', {
            error: getErrorMessage(error),
          });
          return BigInt(0);
        } finally {
          gasPaymentSpan.end();
        }
      },
    );
  }

  private async initializeProgram() {
    // Check for active span from parent, use it if available
    const activeSpan = api.trace.getActiveSpan();
    if (activeSpan) {
      return this.initializeProgramWithSpan(activeSpan);
    }

    return this.otelService.tracer.startActiveSpan(
      'svm.executor.initialize_program',
      {
        attributes: {
          'svm.operation': 'initialize_program',
          'svm.rpc_url': this.solanaConfigService.rpcUrl,
        },
      },
      async (span) => {
        try {
          await this.initializeProgramWithSpan(span);
          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: getErrorMessage(error),
          });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  private async initializeProgramWithSpan(span: api.Span): Promise<void> {
    span.addEvent('svm.initialize.wallet_setup.started');

    // Get cached wallet instance and extract keypair for Anchor
    const svmWallet = this.walletManager.getWallet();
    this.keypair = svmWallet.getKeypair();

    const walletAddress = this.keypair.publicKey.toString();

    span.setAttributes({
      'svm.wallet_address': walletAddress,
    });

    span.addEvent('svm.initialize.wallet_setup.completed', {
      wallet_address: walletAddress,
    });

    // Create Anchor provider with wallet adapter
    span.addEvent('svm.initialize.provider_creation.started');

    const anchorWallet = getAnchorWallet(this.keypair);

    const provider = new AnchorProvider(this.connection, anchorWallet, {
      commitment: 'confirmed',
    });
    setProvider(provider);

    span.setAttributes({
      'svm.provider_commitment': 'confirmed',
    });

    span.addEvent('svm.initialize.provider_creation.completed');

    // Initialize Portal program with IDL
    span.addEvent('svm.initialize.program_initialization.started');

    const portalProgramId = new PublicKey(this.solanaConfigService.portalProgramId);
    const idlWithAddress = { ...portalIdl, address: portalProgramId.toString() };
    this.portalProgram = new Program(idlWithAddress, provider);

    span.setAttributes({
      'svm.portal_program_id': portalProgramId.toString(),
      'svm.program_initialized': true,
    });

    span.addEvent('svm.initialize.program_initialization.completed', {
      portal_program_id: portalProgramId.toString(),
    });

    this.logger.log(`Portal program initialized at ${portalProgramId.toString()}`);
  }

  private determineErrorStage(error: Error): string {
    const errorMessage = error.message.toLowerCase();

    if (
      errorMessage.includes('portal program') ||
      errorMessage.includes('not properly initialized')
    ) {
      return 'initialization';
    } else if (
      errorMessage.includes('withdrawal instruction') ||
      errorMessage.includes('no valid withdrawal')
    ) {
      return 'instruction_generation';
    } else if (errorMessage.includes('transaction') || errorMessage.includes('send')) {
      return 'transaction_submission';
    } else if (errorMessage.includes('confirmation') || errorMessage.includes('confirm')) {
      return 'transaction_confirmation';
    } else if (errorMessage.includes('ata') || errorMessage.includes('associated token')) {
      return 'ata_creation';
    } else {
      return 'unknown';
    }
  }
}
