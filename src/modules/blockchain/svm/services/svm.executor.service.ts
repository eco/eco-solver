import { Injectable } from '@nestjs/common';

import { AnchorProvider, Program, setProvider } from '@coral-xyz/anchor';
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';

import {
  BaseChainExecutor,
  ExecutionResult,
} from '@/common/abstractions/base-chain-executor.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
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
  getCallAccounts,
  getTokenAccounts,
  prepareRouteCalls,
} from '@/modules/blockchain/svm/utils/call-data';
import { toSvmRoute } from '@/modules/blockchain/svm/utils/instruments';
import { getAnchorWallet } from '@/modules/blockchain/svm/utils/wallet-adapter';
import { BlockchainConfigService, SolanaConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';

import { SvmWalletManagerService, SvmWalletType } from './svm-wallet-manager.service';

@Injectable()
export class SvmExecutorService extends BaseChainExecutor {
  private readonly connection: Connection;
  private portalProgram: Program<PortalIdl>;
  private keypair: Keypair;
  private wallet: ISvmWallet | null = null;

  constructor(
    private solanaConfigService: SolanaConfigService,
    private blockchainConfigService: BlockchainConfigService,
    private readonly logger: SystemLoggerService,
    private walletManager: SvmWalletManagerService,
  ) {
    super();
    this.logger.setContext(SvmExecutorService.name);
    this.connection = new Connection(this.solanaConfigService.rpcUrl, 'confirmed');
    this.initializeProgram();
  }

  async fulfill(intent: Intent, _walletId?: string): Promise<ExecutionResult> {
    if (!this.portalProgram || !this.wallet) {
      throw new Error('Portal program not initialized');
    }

    try {
      // Add compute budget instruction to increase CU limit
      // The transaction is consuming ~395k CUs, so we'll set the limit to 600k for safety margin
      const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 600_000,
      });

      const transferInstructions = await buildTokenTransferInstructions(
        intent,
        this.connection,
        await this.wallet.getAddress(),
      );

      // Generate the fulfillment instruction for the Portal program
      const fulfillIx = await this.generateFulfillIx(intent);

      const transaction = new Transaction()
        .add(computeBudgetIx)
        .add(...transferInstructions)
        .add(fulfillIx);

      const signature = await this.wallet.sendTransaction(transaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      this.logger.log(`Intent ${intent.intentHash} fulfilled with signature: ${signature}`);

      return {
        success: true,
        txHash: signature,
      };
    } catch (error) {
      this.logger.error('Solana execution error:', toError(error));
      return {
        success: false,
        error: getErrorMessage(error),
      };
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
    this.logger.warn('Batch withdrawal not yet implemented for Solana');
    // TODO: Implement Solana batch withdrawal when Portal contract supports it
    throw new Error('Batch withdrawal not yet implemented for Solana');
  }

  private async generateFulfillIx(intent: Intent) {
    // Recipient's associated token account (destination)
    // TODO: Use real recipient. For now, using the solver's address as recipient
    //       this should be parsed from call data
    const recipientKeypair = this.keypair;

    const tokenAccounts = await getTokenAccounts(
      intent.route,
      this.keypair,
      this.portalProgram.idl.address,
    );
    const callAccounts = await getCallAccounts(
      intent.route,
      recipientKeypair,
      this.portalProgram.idl.address,
    );

    const svmIntent: Intent = {
      ...intent,
      route: {
        ...intent.route,
        calls: prepareRouteCalls(intent.route.calls, callAccounts),
      },
    };

    const hashes = PortalHashUtils.getIntentHash(svmIntent);

    // Calculate hashes
    const intentHashBuffer = toBuffer(hashes.intentHash);
    const rewardHashBytes = toBuffer(hashes.rewardHash);

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

    const fulfillArgs: Parameters<typeof this.portalProgram.methods.fulfill>[0] = {
      intentHash: { 0: Array.from(intentHashBuffer) }, // Bytes32 format
      route: toSvmRoute(intent.route),
      rewardHash: { 0: Array.from(rewardHashBytes) }, // Bytes32 format
      claimant: { 0: Array.from(claimantBytes32) }, // Bytes32 format
    };

    // Build the fulfill instruction matching the Rust accounts structure
    return this.portalProgram!.methods.fulfill(fulfillArgs)
      .accounts({
        payer: this.keypair.publicKey,
        solver: this.keypair.publicKey,
        executor: executorPDA,
        fulfillMarker: fulfillMarkerPDA,
      })
      .remainingAccounts([...tokenAccounts, ...callAccounts])
      .instruction();
  }

  private async initializeProgram() {
    try {
      // Get wallet
      this.wallet = this.walletManager.createWallet();
      this.keypair = this.wallet.getKeypair();

      // Create Anchor provider with wallet adapter
      const wallet = getAnchorWallet(this.keypair);

      const provider = new AnchorProvider(this.connection, wallet, {
        commitment: 'confirmed',
      });
      setProvider(provider);

      // Initialize Portal program with IDL
      const portalProgramId = new PublicKey(this.solanaConfigService.portalProgramId);
      const idlWithAddress = { ...portalIdl, address: portalProgramId.toString() };
      this.portalProgram = new Program(idlWithAddress, provider);

      this.logger.log(`Portal program initialized at ${portalProgramId.toString()}`);
    } catch (error) {
      this.logger.error('Failed to initialize Portal program:', toError(error));
    }
  }
}
