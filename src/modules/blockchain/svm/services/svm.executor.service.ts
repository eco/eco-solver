import { Injectable } from '@nestjs/common';

import { AnchorProvider, Program, setProvider } from '@coral-xyz/anchor';
import * as api from '@opentelemetry/api';
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';

import {
  BaseChainExecutor,
  ExecutionResult,
} from '@/common/abstractions/base-chain-executor.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
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
          'svm.intent_hash': intent.intentHash,
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
      // Add compute budget instruction to increase CU limit
      // The transaction is consuming ~395k CUs, so we'll set the limit to 600k for safety margin
      // TODO: Move units to SvmConfig
      const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 600_000,
      });

      // Generate the fulfillment instruction for the Portal program
      const { fulfillmentIx, transferInstructions } = await this.generateFulfillIx(intent);

      span.setAttribute('svm.transfer_instruction_count', transferInstructions.length);

      // TODO: Must create a proveIx to prove intents

      const transaction = new Transaction()
        .add(computeBudgetIx)
        .add(...transferInstructions)
        .add(fulfillmentIx);

      span.addEvent('svm.transaction.submitting', {
        instruction_count: 1 + transferInstructions.length + 1, // compute budget + transfers + fulfill
        compute_unit_limit: 600_000,
      });

      // Get wallet from manager for transaction execution
      const wallet = this.walletManager.getWallet();
      const signature = await wallet.sendTransaction(transaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      span.setAttribute('svm.transaction_signature', signature);
      span.addEvent('svm.transaction.submitted');

      this.logger.log(`Intent ${intent.intentHash} fulfilled with signature: ${signature}`);

      span.addEvent('svm.transaction.confirmed');
      if (!activeSpan) {
        span.setStatus({ code: api.SpanStatusCode.OK });
      }

      return {
        success: true,
        txHash: signature,
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
