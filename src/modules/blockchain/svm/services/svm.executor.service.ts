import { Injectable } from '@nestjs/common';

import { AnchorProvider, BN, Program, setProvider } from '@coral-xyz/anchor';
import * as api from '@opentelemetry/api';
import { createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';

import {
  BaseChainExecutor,
  ExecutionResult,
} from '@/common/abstractions/base-chain-executor.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { TProverType } from '@/common/interfaces/prover.interface';
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
  ) {
    super();
    this.logger.setContext(SvmExecutorService.name);
    this.connection = new Connection(this.solanaConfigService.rpcUrl, 'confirmed');
  }

  async fulfill(intent: Intent, _walletId?: string): Promise<ExecutionResult> {
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('svm.executor.fulfill', {
        attributes: {
          'svm.intent_id': intent.intentHash,
          'svm.source_chain': intent.sourceChainId?.toString(),
          'svm.destination_chain': intent.destination.toString(),
          'svm.operation': 'fulfill',
          'svm.wallet_id': _walletId || 'default',
        },
      });

    // Lazy initialization of Portal program
    if (!this.isInitialized) {
      try {
        await this.initializeProgram();
        this.isInitialized = true;
      } catch (error) {
        this.logger.error('Failed to initialize Portal program during fulfill:', toError(error));
        if (!activeSpan) {
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
        }
        throw error;
      }
    }

    if (!this.portalProgram || !this.keypair) {
      const error = new Error('Portal program or keypair not properly initialized');
      if (!activeSpan) {
        span.recordException(error);
        span.setStatus({ code: api.SpanStatusCode.ERROR });
      }
      throw error;
    }

    try {
      // Step 1: Execute the fulfill transaction
      const fulfillResult = await this.executeFulfillTransaction(intent, span);

      if (!fulfillResult.success) {
        return fulfillResult;
      }

      this.logger.log(
        `Intent ${intent.intentHash} fulfilled with signature: ${fulfillResult.txHash}`,
      );

      // Step 2: Execute the prove transaction
      const proveResult = await this.executeProveTransaction(intent, span);

      if (proveResult && !proveResult.success) {
        this.logger.error(
          `Prove transaction failed for intent ${intent.intentHash}: ${proveResult.error}`,
        );
      } else if (proveResult && proveResult.success) {
        this.logger.log(`Intent ${intent.intentHash} proved with signature: ${proveResult.txHash}`);
      }

      span.addEvent('svm.transaction.confirmed');
      if (!activeSpan) {
        span.setStatus({ code: api.SpanStatusCode.OK });
      }

      return {
        success: true,
        txHash: fulfillResult.txHash,
      };
    } catch (error) {
      this.logger.error('Solana execution error:', toError(error));
      if (!activeSpan) {
        span.recordException(toError(error));
        span.setStatus({ code: api.SpanStatusCode.ERROR });
      }
      return {
        success: false,
        error: getErrorMessage(error),
      };
    } finally {
      if (!activeSpan) {
        span.end();
      }
    }
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
    const span = this.otelService.startSpan('svm.executor.batchWithdraw', {
      attributes: {
        'svm.chain_id': chainId.toString(),
        'svm.wallet_id': _walletId || 'default',
        'svm.operation': 'batchWithdraw',
        'svm.intent_count': withdrawalData.destinations?.length || 0,
      },
    });

    try {
      // Lazy initialization of Portal program
      if (!this.isInitialized) {
        await this.initializeProgram();
        this.isInitialized = true;
      }

      if (!this.portalProgram || !this.keypair) {
        throw new Error('Portal program or keypair not properly initialized');
      }

      this.logger.log(
        `Executing batch withdrawal for ${withdrawalData.destinations?.length || 0} intents on Solana (chain ${chainId})`,
      );

      span.setAttribute('svm.destinations_count', withdrawalData.destinations?.length || 0);

      // Create withdrawal instructions for each intent
      const { withdrawalInstructions, ataCreationInstructions } =
        await this.createWithdrawalInstructions(withdrawalData);

      if (withdrawalInstructions.length === 0) {
        throw new Error('No valid withdrawal instructions generated');
      }

      const computeUnits = Math.min(1_400_000, 500_000 * withdrawalInstructions.length);
      const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: computeUnits,
      });

      this.logger.log(
        `Creating transaction with ${ataCreationInstructions.length} ATA creation instructions and ${withdrawalInstructions.length} withdrawal instructions`,
      );

      // Create and send transaction - compute budget instructions must be first, then ATA creations, then withdrawals
      const transaction = new Transaction()
        .add(computeBudgetIx)
        .add(...ataCreationInstructions)
        .add(...withdrawalInstructions);

      const wallet = this.walletManager.getWallet();
      const signature = await wallet.sendTransaction(transaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      span.setAttribute('svm.batch_withdraw_signature', signature);
      span.addEvent('svm.batch_withdraw.submitted', {
        instruction_count: withdrawalInstructions.length + ataCreationInstructions.length + 2, // +2 for compute budget and price instructions
        ata_creation_count: ataCreationInstructions.length,
        withdrawal_count: withdrawalInstructions.length,
        signature,
      });

      this.logger.log(
        `Successfully executed batch withdrawal for ${withdrawalInstructions.length} intents with ${ataCreationInstructions.length} ATA creations. Signature: ${signature}`,
      );

      span.setStatus({ code: api.SpanStatusCode.OK });
      return signature;
    } catch (error) {
      this.logger.error('Solana batch withdrawal error:', toError(error));
      span.recordException(toError(error));
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  private async createWithdrawalInstructions(withdrawalData: any): Promise<{
    withdrawalInstructions: any[];
    ataCreationInstructions: any[];
  }> {
    const withdrawalInstructions: any[] = [];
    const ataCreationInstructions: any[] = [];

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

    for (let i = 0; i < destinations.length; i++) {
      try {
        const destination = BigInt(destinations[i]);
        const routeHash = routeHashes[i];
        const reward = rewards[i];

        this.logger.debug(
          `Processing withdrawal for destination: ${destination}, routeHash: ${routeHash}`,
        );
        const intentHashHex = PortalHashUtils.intentHash(
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

        this.logger.debug(
          `Created withdrawal instruction for intent hash: ${intentHashHex}, claimant: ${claimantPublicKey.toString()}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to create withdrawal instruction for intent ${i}: ${getErrorMessage(error)}`,
        );
        // Continue with other intents rather than failing the entire batch
        continue;
      }
    }

    return { withdrawalInstructions, ataCreationInstructions };
  }

  private async generateTokenAccountMetas(
    tokens: any[],
    vaultPDA: PublicKey,
    claimantPublicKey: PublicKey,
  ): Promise<{ tokenAccountMetas: any[]; createATAInstructions: any[] }> {
    const tokenAccountMetas: any[] = [];
    const createATAInstructions: any[] = [];
    const tokenProgram = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

    for (const token of tokens) {
      const mintPublicKey = new PublicKey(AddressNormalizer.denormalizeToSvm(token.token));

      // Calculate vault ATA
      const vaultATA = await this.getAssociatedTokenAddress(mintPublicKey, vaultPDA, tokenProgram);

      // Calculate claimant ATA
      const claimantATA = await this.getAssociatedTokenAddress(
        mintPublicKey,
        claimantPublicKey,
        tokenProgram,
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

          this.logger.debug(`Will create ATA for claimant: ${claimantATA.toString()}`);
        }
      } catch (error) {
        this.logger.warn(`Could not check claimant ATA ${claimantATA.toString()}: ${error}`);
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
    }

    return { tokenAccountMetas, createATAInstructions };
  }

  private async getAssociatedTokenAddress(
    mint: PublicKey,
    owner: PublicKey,
    tokenProgram: PublicKey,
  ): Promise<PublicKey> {
    const [ata] = PublicKey.findProgramAddressSync(
      [owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
      new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'), // Associated Token Program
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
    this.logger.debug(`Generating fulfill instruction for intent: ${intent.intentHash}`);
    if (!this.portalProgram || !this.keypair) {
      throw new Error('Portal program not initialized');
    }

    const tokenAccounts = await getTokenAccounts(
      intent.route,
      this.keypair,
      this.portalProgram.idl.address,
    );

    // Construct calls

    const calls = decodeRouteCalls(intent.route.calls);
    const callAccounts = calls.map((call) => call.accounts).flat();

    const recipients = calls.map(
      (call) => getTransferDestination(call.calldata.data, call.accounts).pubkey,
    );

    // Get Token Instructions
    const wallet = this.walletManager.getWallet();
    const walletAddress = await wallet.getAddress();

    const transferInstructions = await buildTokenTransferInstructions(
      intent.route.tokens,
      this.connection,
      walletAddress,
      recipients,
    );

    // Calculate hashes
    const { intentHash, rewardHash } = PortalHashUtils.getIntentHash(intent);
    const intentHashBuffer = toBuffer(intentHash);
    const rewardHashBytes = toBuffer(rewardHash);

    // Get claimant from configuration
    const configuredClaimant = this.blockchainConfigService.getClaimant(intent.sourceChainId);
    const claimantPublicKey = new PublicKey(AddressNormalizer.denormalizeToSvm(configuredClaimant));
    const claimantBytes32 = new Uint8Array(32);
    claimantBytes32.set(claimantPublicKey.toBytes());

    const [fulfillMarkerPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('fulfill_marker'), intentHashBuffer],
      this.portalProgram.programId,
    );

    const [executorPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('executor')],
      this.portalProgram.programId,
    );

    // Prepare route data for the instruction

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

    return { fulfillmentIx, transferInstructions };
  }

  private async executeFulfillTransaction(intent: Intent, span: any): Promise<ExecutionResult> {
    try {
      // Add compute budget instruction for fulfill transaction
      const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 600_000, // Reduced from 800k since we're only doing fulfill
      });

      // Generate the fulfillment instruction for the Portal program
      const { fulfillmentIx, transferInstructions } = await this.generateFulfillIx(intent);

      span.setAttribute('svm.transfer_instruction_count', transferInstructions.length);

      const transaction = new Transaction()
        .add(computeBudgetIx)
        .add(...transferInstructions)
        .add(fulfillmentIx);

      span.addEvent('svm.fulfill_transaction.submitting', {
        instruction_count: 1 + transferInstructions.length + 1, // compute budget + transfers + fulfill
        compute_unit_limit: 600_000,
      });

      // Get wallet and send transaction
      const wallet = this.walletManager.getWallet();
      const signature = await wallet.sendTransaction(transaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      span.setAttribute('svm.fulfill_transaction_signature', signature);
      span.addEvent('svm.fulfill_transaction.submitted');

      return {
        success: true,
        txHash: signature,
      };
    } catch (error) {
      this.logger.error(
        `Failed to execute fulfill transaction for intent ${intent.intentHash}:`,
        toError(error),
      );
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  private async executeProveTransaction(
    intent: Intent,
    span: any,
  ): Promise<ExecutionResult | null> {
    try {
      const proveResult = await this.generateProveIx(intent);

      if (!proveResult) {
        this.logger.debug(
          `No prove instruction generated for intent ${intent.intentHash}, skipping prove transaction`,
        );
        return null;
      }

      const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 400_000,
      });

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

      span.addEvent('svm.prove_transaction.submitting', {
        instruction_count: 2, // compute budget + prove
        compute_unit_limit: 400_000,
        additional_signers: proveResult.signers.length,
      });

      const signature = await this.connection.sendTransaction(versionedTx, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      await this.connection.confirmTransaction(signature, 'confirmed');

      span.setAttribute('svm.prove_transaction_signature', signature);
      span.addEvent('svm.prove_transaction.submitted');

      // Parse the message ID from the transaction logs
      const messageId = await this.parseMessageIdFromTransaction(signature);
      if (messageId) {
        const gasPaymentResult = await this.payForGasForProve(intent, messageId, span);
        this.logger.log(
          `Gas payment result for intent ${intent.intentHash} with message id: 0x${Buffer.from(messageId).toString('hex')}, payment amount: ${gasPaymentResult}`,
        );
      } else {
        this.logger.warn(
          `Could not parse message ID from prove transaction ${signature} for intent ${intent.intentHash}, skipping gas payment`,
        );
      }

      return {
        success: true,
        txHash: signature,
      };
    } catch (error) {
      this.logger.error(
        `Failed to execute prove transaction for intent ${intent.intentHash}:`,
        toError(error),
      );
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  private async generateProveIx(
    intent: Intent,
  ): Promise<{ instruction: any; signers: Keypair[] } | null> {
    try {
      // Get the prover for this intent
      const sourceChainId = Number(intent.sourceChainId);
      const prover = this.proverService.getProver(sourceChainId, intent.reward.prover);

      if (!this.portalProgram) {
        throw new Error('Portal program not initialized');
      }
      const portalProgram = this.portalProgram;

      if (!prover) {
        this.logger.warn(
          `No prover found for intent ${intent.intentHash}, skipping prove instruction`,
        );
        return null;
      }

      const destinationChainId = Number(intent.destination);
      const proverAddress = this.blockchainConfigService.getProverAddress(
        destinationChainId,
        prover.type as TProverType,
      );

      if (!proverAddress) {
        this.logger.warn(
          `No prover address configured for ${prover.type} on chain ${destinationChainId}, skipping prove instruction`,
        );
        return null;
      }

      // For Hyper prover, the data should be the source prover address as 32 bytes
      // Get the source prover address (the prover address on the source chain)
      const sourceProverAddress = intent.reward.prover;

      // Convert to 32 bytes - pad or truncate as needed
      const sourceProverBytes = Buffer.alloc(32);
      const sourceProverBuffer = Buffer.from(
        AddressNormalizer.denormalizeToEvm(sourceProverAddress).slice(2),
        'hex',
      );
      sourceProverBuffer.copy(sourceProverBytes, 32 - sourceProverBuffer.length); // Right-align (pad left with zeros)

      // Calculate intent hash
      const { intentHash } = PortalHashUtils.getIntentHash(intent);
      const intentHashBuffer = toBuffer(intentHash);

      const [fulfillMarkerPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('fulfill_marker'), intentHashBuffer],
        portalProgram.programId,
      );
      const [dispatcherPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('dispatcher')],
        portalProgram.programId,
      );

      const proveArgs: Parameters<typeof portalProgram.methods.prove>[0] = {
        prover: new PublicKey(AddressNormalizer.denormalizeToSvm(proverAddress)),
        sourceChainDomainId: new BN(sourceChainId),
        intentHashes: [{ 0: Array.from(intentHashBuffer) }],
        data: sourceProverBytes,
      };

      const proverDispatcherPDA = this.getProverDispatcherPDA(proverAddress);
      const outboxPDA = this.getHyperlaneOutboxPDA();
      const uniqueMessageKeypair = Keypair.generate(); // Generate a unique keypair for the message
      const dispatchedMessagePDA = this.getHyperlaneDispatchedMessagePDA(
        uniqueMessageKeypair.publicKey,
      );
      const mailboxProgram = this.getHyperlaneMailboxProgram();

      const remainingAccounts = [
        {
          pubkey: fulfillMarkerPDA,
          isSigner: false,
          isWritable: false,
        },
        // Hyper prover specific accounts (matching the integration test)
        { pubkey: proverDispatcherPDA, isSigner: false, isWritable: false },
        { pubkey: this.keypair!.publicKey, isSigner: true, isWritable: true }, // payer
        { pubkey: outboxPDA, isSigner: false, isWritable: true },
        { pubkey: this.getNoopProgram(), isSigner: false, isWritable: false },
        { pubkey: uniqueMessageKeypair.publicKey, isSigner: true, isWritable: false },
        { pubkey: dispatchedMessagePDA, isSigner: false, isWritable: true },
        {
          pubkey: new PublicKey(SystemProgram.programId.toString()),
          isSigner: false,
          isWritable: false,
        },
        { pubkey: mailboxProgram, isSigner: false, isWritable: false },
      ];

      const proveIx = await portalProgram.methods
        .prove(proveArgs)
        .accounts({
          prover: new PublicKey(AddressNormalizer.denormalizeToSvm(proverAddress)),
          dispatcher: dispatcherPDA,
        })
        .remainingAccounts(remainingAccounts)
        .instruction();

      this.logger.debug(
        `Generated prove instruction for intent ${intent.intentHash} with prover ${prover.type} and unique message signer`,
      );

      return {
        instruction: proveIx,
        signers: [uniqueMessageKeypair],
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate prove instruction for intent ${intent.intentHash}:`,
        toError(error),
      );
      // Return null to continue without prove instruction rather than failing the entire transaction
      return null;
    }
  }

  private getProverDispatcherPDA(proverAddress: UniversalAddress): PublicKey {
    // This matches hyper_prover::state::dispatcher_pda().0
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('dispatcher')],
      new PublicKey(AddressNormalizer.denormalizeToSvm(proverAddress)),
    );
    return pda;
  }

  private getHyperlaneOutboxPDA(): PublicKey {
    // This matches hyperlane_context::outbox_pda()
    // Rust: Pubkey::find_program_address(&[b"hyperlane", b"-", b"outbox"], &MAILBOX_ID).0
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('hyperlane'), Buffer.from('-'), Buffer.from('outbox')],
      this.getHyperlaneMailboxProgram(),
    );
    return pda;
  }

  private getHyperlaneDispatchedMessagePDA(uniqueMessage: PublicKey): PublicKey {
    // This matches hyperlane_context::dispatched_message_pda(&unique_message.pubkey())
    // Rust: Pubkey::find_program_address(&[b"hyperlane", b"-", b"dispatched_message", b"-", unique_message.pubkey().as_ref()], &MAILBOX_ID).0
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('hyperlane'),
        Buffer.from('-'),
        Buffer.from('dispatched_message'),
        Buffer.from('-'),
        uniqueMessage.toBuffer(),
      ],
      this.getHyperlaneMailboxProgram(),
    );
    return pda;
  }

  private getHyperlaneMailboxProgram(): PublicKey {
    return new PublicKey('E588QtVUvresuXq2KoNEwAmoifCzYGpRBdHByN9KQMbi');
  }

  private getNoopProgram(): PublicKey {
    return new PublicKey('noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV');
  }

  private async parseMessageIdFromTransaction(signature: string): Promise<Uint8Array | null> {
    try {
      const transaction = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (!transaction?.meta?.logMessages) {
        this.logger.warn(`No log messages found for transaction ${signature}`);
        return null;
      }

      // Look for the "Dispatched message" log
      const dispatchedMessageLog = transaction.meta.logMessages.find((log) =>
        log.includes('Program log: Dispatched message to'),
      );

      if (!dispatchedMessageLog) {
        this.logger.warn(`No dispatched message log found in transaction ${signature}`);
        return null;
      }

      // Parse the message ID from the log
      // Expected format: "Program log: Dispatched message to 10, ID 0x92ca37ae8ecce8788a55825c82a6da6c19bcb3183c7e5eb2fdd95a0c37203560"
      const messageIdMatch = dispatchedMessageLog.match(/ID (0x[a-fA-F0-9]{64})/);
      if (!messageIdMatch) {
        this.logger.warn(`Could not parse message ID from log: ${dispatchedMessageLog}`);
        return null;
      }

      const messageIdHex = messageIdMatch[1];
      const messageId = new Uint8Array(32);
      messageId.set(Buffer.from(messageIdHex.slice(2), 'hex'));

      this.logger.debug(`Parsed message ID from transaction ${signature}: ${messageIdHex}`);
      return messageId;
    } catch (error) {
      this.logger.error(
        `Failed to parse message ID from transaction ${signature}: ${getErrorMessage(error)}`,
      );
      return null;
    }
  }

  private async payForGasForProve(intent: Intent, messageId: Uint8Array, span: any): Promise<bigint> {
    try {
      // Get IGP configuration
      const igpProgramId = new PublicKey('BhNcatUDC2D5JTyeaqrdSukiVFsEHK7e3hVmKMztwefv');
      const igpAccount = new PublicKey('JAvHW21tYXE9dtdG83DReqU2b4LUexFuCbtJT5tF8X6M');
      const overheadIgpAccount = new PublicKey('AkeHBbE5JkwVppujCQQ6WuxsVsJtruBAjUo6fDCFp6fF');

      if (!igpProgramId || !igpAccount) {
        this.logger.warn(
          `IGP not configured for Solana, skipping gas payment for intent ${intent.intentHash}`,
        );
        return BigInt(0);
      }

      const destinationDomain = Number(intent.sourceChainId);
      const gasAmount = BigInt(130000); // fixed gas amount for now

      span.addEvent('svm.gas_payment.processing', {
        destination_domain: destinationDomain,
        gas_amount: gasAmount.toString(),
        igp_program_id: igpProgramId.toString(),
        igp_account: igpAccount.toString(),
        overhead_igp_account: overheadIgpAccount.toString(),
        message_id: Buffer.from(messageId).toString('hex'),
      });

      // Get wallet for payer and fee payer
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

      span.setAttribute('svm.gas_payment.quoted_amount', quotedAmount.toString());
      span.setAttribute('svm.gas_payment.pda', gasPaymentPDA.toString());
      span.addEvent('svm.gas_payment.quoted');

      const { blockhash } = await this.connection.getLatestBlockhash();
      const payForGasTransaction = new Transaction({
        recentBlockhash: blockhash,
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

      span.setAttribute('svm.gas_payment.transaction_signature', signature);
      span.addEvent('svm.gas_payment.confirmed');

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
    }
  }

  private async initializeProgram() {
    // Get cached wallet instance and extract keypair for Anchor
    const svmWallet = this.walletManager.getWallet();
    this.keypair = svmWallet.getKeypair();

    // Create Anchor provider with wallet adapter
    const anchorWallet = getAnchorWallet(this.keypair);

    const provider = new AnchorProvider(this.connection, anchorWallet, {
      commitment: 'confirmed',
    });
    setProvider(provider);

    // Initialize Portal program with IDL
    const portalProgramId = new PublicKey(this.solanaConfigService.portalProgramId);
    const idlWithAddress = { ...portalIdl, address: portalProgramId.toString() };
    this.portalProgram = new Program(idlWithAddress, provider);

    this.logger.log(`Portal program initialized at ${portalProgramId.toString()}`);
  }
}