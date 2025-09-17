import { Injectable } from '@nestjs/common';

import { AnchorProvider, BN, Program, setProvider } from '@coral-xyz/anchor';
import * as api from '@opentelemetry/api';
import { 
  ComputeBudgetProgram, 
  Connection, 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  Transaction,
  TransactionMessage,
  VersionedTransaction
} from '@solana/web3.js';

import {
  BaseChainExecutor,
  ExecutionResult,
} from '@/common/abstractions/base-chain-executor.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { TProverType } from '@/common/interfaces/prover.interface';
import { ISvmWallet } from '@/common/interfaces/svm-wallet.interface';
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

      this.logger.log(`Intent ${intent.intentHash} fulfilled with signature: ${fulfillResult.txHash}`);
      
      // Step 2: Execute the prove transaction (if prover is available)
      const proveResult = await this.executeProveTransaction(intent, span);
      
      if (proveResult && !proveResult.success) {
        this.logger.warn(`Prove transaction failed for intent ${intent.intentHash}: ${proveResult.error}`);
        // Continue anyway - fulfill succeeded, prove is optional
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
   * NOTE: This is a placeholder implementation as Solana batch withdrawals
   * may require different approach than EVM
   */
  async executeBatchWithdraw(
    _chainId: bigint,
    _withdrawalData: any,
    _walletId?: string,
  ): Promise<string> {
    const span = this.otelService.startSpan('svm.executor.batchWithdraw', {
      attributes: {
        'svm.chain_id': _chainId.toString(),
        'svm.wallet_id': _walletId || 'default',
        'svm.operation': 'batchWithdraw',
        'svm.status': 'not_implemented',
      },
    });

    try {
      this.logger.warn('Batch withdrawal not yet implemented for Solana');
      // TODO: Implement Solana batch withdrawal when Portal contract supports it
      const error = new Error('Batch withdrawal not yet implemented for Solana');
      span.recordException(error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  private async generateFulfillIx(intent: Intent) {
    // Ensure we have initialized the program
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
      this.logger.error(`Failed to execute fulfill transaction for intent ${intent.intentHash}:`, toError(error));
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  private async executeProveTransaction(intent: Intent, span: any): Promise<ExecutionResult | null> {
    try {
      // Generate the prove instruction
      const proveResult = await this.generateProveIx(intent);
      
      if (!proveResult) {
        this.logger.debug(`No prove instruction generated for intent ${intent.intentHash}, skipping prove transaction`);
        return null;
      }

      // Add compute budget instruction for prove transaction
      const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 400_000, // Prove transaction typically needs less CUs
      });

      // Get the latest blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      
      // Create versioned transaction with just the prove instruction (no memo needed)
      const messageV0 = new TransactionMessage({
        payerKey: this.walletManager.getWallet().getKeypair().publicKey,
        recentBlockhash: blockhash,
        instructions: [computeBudgetIx, proveResult.instruction],
      }).compileToV0Message();
      
      const versionedTx = new VersionedTransaction(messageV0);
      
      // Sign with wallet keypair first
      const wallet = this.walletManager.getWallet();
      versionedTx.sign([wallet.getKeypair()]);
      
      // Sign with additional signers (unique message keypair)
      versionedTx.sign(proveResult.signers);
      
      span.addEvent('svm.prove_transaction.submitting', {
        instruction_count: 2, // compute budget + prove
        compute_unit_limit: 400_000,
        additional_signers: proveResult.signers.length,
      });

      // Send the versioned transaction
      const signature = await this.connection.sendTransaction(versionedTx, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      
      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');

      span.setAttribute('svm.prove_transaction_signature', signature);
      span.addEvent('svm.prove_transaction.submitted');

      return {
        success: true,
        txHash: signature,
      };
    } catch (error) {
      this.logger.error(`Failed to execute prove transaction for intent ${intent.intentHash}:`, toError(error));
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  private async generateProveIx(intent: Intent): Promise<{ instruction: any; signers: Keypair[] } | null> {
    try {
      // Get the prover for this intent
      const sourceChainId = Number(intent.sourceChainId);
      const prover = this.proverService.getProver(sourceChainId, intent.reward.prover);
      
      if (!this.portalProgram) {
        throw new Error('Portal program not initialized');
      }
      const portalProgram = this.portalProgram;

      if (!prover) {
        this.logger.warn(`No prover found for intent ${intent.intentHash}, skipping prove instruction`);
        return null;
      }

      // Get prover address on destination chain (Solana)
      const destinationChainId = Number(intent.destination);
      const proverAddress = this.blockchainConfigService.getProverAddress(
        destinationChainId, 
        prover.type as TProverType
      );
      
      if (!proverAddress) {
        this.logger.warn(`No prover address configured for ${prover.type} on chain ${destinationChainId}, skipping prove instruction`);
        return null;
      }
      console.log('proverAddress', proverAddress);

      // For Hyper prover, the data should be the source prover address as 32 bytes
      // Get the source prover address (the prover address on the source chain)
      const sourceProverAddress = intent.reward.prover;
      console.log('sourceProverAddress', sourceProverAddress);
      
      // Convert to 32 bytes - pad or truncate as needed
      const sourceProverBytes = Buffer.alloc(32);
      const sourceProverBuffer = Buffer.from(AddressNormalizer.denormalizeToEvm(sourceProverAddress).slice(2), 'hex');
      sourceProverBuffer.copy(sourceProverBytes, 32 - sourceProverBuffer.length); // Right-align (pad left with zeros)
      
      console.log('sourceProverBytes', sourceProverBytes.toString('hex'));
      
      // Calculate intent hash
      const { intentHash } = PortalHashUtils.getIntentHash(intent);
      const intentHashBuffer = toBuffer(intentHash);

      // Get fulfill marker PDA for this intent
      const [fulfillMarkerPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('fulfill_marker'), intentHashBuffer],
        portalProgram.programId,
      );

      // Get dispatcher PDA
      const [dispatcherPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('dispatcher')],
        portalProgram.programId,
      );

      // Prepare prove arguments
      const proveArgs: Parameters<typeof portalProgram.methods.prove>[0] = {
        prover: new PublicKey(AddressNormalizer.denormalizeToSvm(proverAddress)),
        sourceChainDomainId: new BN(sourceChainId),
        intentHashes: [{ 0: Array.from(intentHashBuffer) }], // Array of Bytes32
        data: sourceProverBytes, // 32-byte source prover address
      };

      // Build remaining accounts for Hyper prover
      // Based on the integration test, we need Hyperlane-specific accounts
      const proverDispatcherPDA = this.getProverDispatcherPDA(proverAddress);
      const outboxPDA = this.getHyperlaneOutboxPDA();
      const uniqueMessageKeypair = Keypair.generate(); // Generate a unique keypair for the message
      const dispatchedMessagePDA = this.getHyperlaneDispatchedMessagePDA(uniqueMessageKeypair.publicKey);
      const mailboxProgram = this.getHyperlaneMailboxProgram();

      const remainingAccounts = [
        // Fulfill marker account (must be first, corresponding to intent_hashes order)
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
        { pubkey: new PublicKey(SystemProgram.programId.toString()), isSigner: false, isWritable: false }, // system program
        { pubkey: mailboxProgram, isSigner: false, isWritable: false },
      ];

      // Build the prove instruction
      const proveIx = await portalProgram.methods.prove(proveArgs)
        .accounts({
          prover: new PublicKey(AddressNormalizer.denormalizeToSvm(proverAddress)),
          dispatcher: dispatcherPDA,
        })
        .remainingAccounts(remainingAccounts)
        .instruction();

      this.logger.debug(`Generated prove instruction for intent ${intent.intentHash} with prover ${prover.type} and unique message signer`);
      
      return {
        instruction: proveIx,
        signers: [uniqueMessageKeypair] // Return the additional signer needed
      };

    } catch (error) {
      this.logger.error(`Failed to generate prove instruction for intent ${intent.intentHash}:`, toError(error));
      // Return null to continue without prove instruction rather than failing the entire transaction
      return null;
    }
  }

  private getProverDispatcherPDA(proverAddress: UniversalAddress): PublicKey {
    // This matches hyper_prover::state::dispatcher_pda().0
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('dispatcher')],
      new PublicKey(AddressNormalizer.denormalizeToSvm(proverAddress))
    );
    return pda;
  }

  private getHyperlaneOutboxPDA(): PublicKey {
    // This matches hyperlane_context::outbox_pda()
    // Rust: Pubkey::find_program_address(&[b"hyperlane", b"-", b"outbox"], &MAILBOX_ID).0
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('hyperlane'),
        Buffer.from('-'),
        Buffer.from('outbox')
      ],
      this.getHyperlaneMailboxProgram()
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
        uniqueMessage.toBuffer()
      ],
      this.getHyperlaneMailboxProgram()
    );
    return pda;
  }

  private getHyperlaneMailboxProgram(): PublicKey {
    return new PublicKey('E588QtVUvresuXq2KoNEwAmoifCzYGpRBdHByN9KQMbi');
  }

  private getNoopProgram(): PublicKey {
    return new PublicKey('noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV');
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
