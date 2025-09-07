import { Injectable } from '@nestjs/common';

import { AnchorProvider, BN, Program, setProvider } from '@coral-xyz/anchor';
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import { Hex } from 'viem';

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
import { portalIDL } from '@/modules/blockchain/svm/idl/portal';
import { BlockchainConfigService, SolanaConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { ProverService } from '@/modules/prover/prover.service';

import { SvmWalletManagerService } from './svm-wallet-manager.service';

// Use untyped Program for Portal to avoid IDL type issues
type PortalProgram = Program;

@Injectable()
export class SvmExecutorService extends BaseChainExecutor {
  private readonly connection: Connection;
  private portalProgram: PortalProgram | null = null;
  private wallet: ISvmWallet | null = null;

  constructor(
    private solanaConfigService: SolanaConfigService,
    private blockchainConfigService: BlockchainConfigService,
    private readonly logger: SystemLoggerService,
    private proverService: ProverService,
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
      // Get source chain info for hash calculation
      if (!intent.sourceChainId) {
        throw new Error(`Intent ${intent.intentHash} is missing required sourceChainId`);
      }
      const sourceChainId = intent.sourceChainId;

      // Get prover and generate proof data
      const prover = this.proverService.getProver(Number(sourceChainId), intent.reward.prover);
      if (!prover) {
        throw new Error('Prover not found for intent fulfillment');
      }

      const proverAddr = prover.getContractAddress(Number(intent.destination));
      const _proofData = await prover.generateProof(intent);

      // Calculate hashes
      const rewardHash = PortalHashUtils.computeRewardHash(intent.reward);
      const intentHashBuffer = Buffer.from(intent.intentHash.slice(2), 'hex');

      // Get claimant from configuration
      const configuredClaimant = this.blockchainConfigService.getClaimant(sourceChainId);
      const claimantPublicKey = new PublicKey(
        AddressNormalizer.denormalizeToSvm(configuredClaimant),
      );

      // Derive PDAs (Program Derived Addresses)
      const [vaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), intentHashBuffer],
        this.portalProgram.programId,
      );

      const [fulfillMarkerPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('fulfill_marker'), intentHashBuffer],
        this.portalProgram.programId,
      );

      const [executorPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('executor')],
        this.portalProgram.programId,
      );

      // Convert prover address to Bytes32 format expected by the program
      const _proverBytes32 = this.addressToBytes32(proverAddr!);

      // Prepare route data for the instruction
      const routeData = this.prepareRouteData(intent.route);

      // Build fulfill instruction using Anchor (untyped)
      const fulfillMethod = (this.portalProgram.methods as any).fulfill(
        Array.from(intentHashBuffer), // intent_hash as [u8; 32]
        routeData, // route
        Array.from(Buffer.from(rewardHash.slice(2), 'hex')), // reward_hash as [u8; 32]
        this.publicKeyToBytes32(claimantPublicKey), // claimant as [u8; 32]
      );

      const fulfillIx = await fulfillMethod
        .accounts({
          vault: vaultPDA,
          fulfillMarker: fulfillMarkerPDA,
          executor: executorPDA,
          solver: this.wallet.getKeypair().publicKey,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      // Build and send transaction
      const transaction = new Transaction().add(fulfillIx);

      // Process token transfers if needed
      if (intent.route.tokens && intent.route.tokens.length > 0) {
        const transferInstructions = await this.buildTokenTransferInstructions(intent);
        transferInstructions.forEach((ix) => transaction.add(ix));
      }

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

  async fulfillAndProve(intent: Intent, _walletId?: string): Promise<ExecutionResult> {
    if (!this.portalProgram || !this.wallet) {
      throw new Error('Portal program not initialized');
    }

    try {
      // Get source chain info
      if (!intent.sourceChainId) {
        throw new Error(`Intent ${intent.intentHash} is missing required sourceChainId`);
      }
      const sourceChainId = intent.sourceChainId;

      // Get prover and generate proof data
      const prover = this.proverService.getProver(Number(sourceChainId), intent.reward.prover);
      if (!prover) {
        throw new Error('Prover not found for intent fulfillment');
      }

      const proverAddr = prover.getContractAddress(Number(intent.destination));
      const proofData = await prover.generateProof(intent);

      // Calculate hashes
      const rewardHash = PortalHashUtils.computeRewardHash(intent.reward);
      const intentHashBuffer = Buffer.from(intent.intentHash.slice(2), 'hex');

      // Get claimant
      const configuredClaimant = this.blockchainConfigService.getClaimant(sourceChainId);
      const claimantPublicKey = new PublicKey(
        AddressNormalizer.denormalizeToSvm(configuredClaimant),
      );

      // Derive PDAs
      const [vaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), intentHashBuffer],
        this.portalProgram.programId,
      );

      const [fulfillMarkerPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('fulfill_marker'), intentHashBuffer],
        this.portalProgram.programId,
      );

      const [proverPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('prover'), Buffer.from(proverAddr!.slice(2), 'hex')],
        this.portalProgram.programId,
      );

      const [executorPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('executor')],
        this.portalProgram.programId,
      );

      // Prepare data
      const routeData = this.prepareRouteData(intent.route);
      const proverBytes32 = this.addressToBytes32(proverAddr!);

      // Build fulfillAndProve instruction using Anchor (untyped)
      const fulfillAndProveMethod = (this.portalProgram.methods as any).fulfillAndProve(
        Array.from(intentHashBuffer),
        routeData,
        Array.from(Buffer.from(rewardHash.slice(2), 'hex')),
        this.publicKeyToBytes32(claimantPublicKey),
        proverBytes32,
        new BN(sourceChainId.toString()),
        Array.from(Buffer.from(proofData.slice(2), 'hex')),
      );

      const fulfillAndProveIx = await fulfillAndProveMethod
        .accounts({
          vault: vaultPDA,
          fulfillMarker: fulfillMarkerPDA,
          prover: proverPDA,
          executor: executorPDA,
          solver: this.wallet.getKeypair().publicKey,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      // Build and send transaction
      const transaction = new Transaction().add(fulfillAndProveIx);

      // Process token transfers if needed
      if (intent.route.tokens && intent.route.tokens.length > 0) {
        const transferInstructions = await this.buildTokenTransferInstructions(intent);
        transferInstructions.forEach((ix) => transaction.add(ix));
      }

      const signature = await this.wallet.sendTransaction(transaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      this.logger.log(
        `Intent ${intent.intentHash} fulfilled and proven with signature: ${signature}`,
      );

      return {
        success: true,
        txHash: signature,
      };
    } catch (error) {
      this.logger.error('Solana fulfillAndProve error:', toError(error));
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

  async getWalletAddress(): Promise<UniversalAddress> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    const publicKey = await this.wallet.getAddress();
    return AddressNormalizer.normalizeSvm(publicKey.toString());
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
   * Derives vault PDA for the given intent
   */
  deriveVaultPDA(intentHash: Hex): PublicKey {
    if (!this.portalProgram) {
      throw new Error('Portal program not initialized');
    }
    const intentHashBuffer = Buffer.from(intentHash.slice(2), 'hex');
    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), intentHashBuffer],
      this.portalProgram.programId,
    );
    return vaultPDA;
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

  private async initializeProgram() {
    try {
      // Get wallet
      this.wallet = this.walletManager.createWallet();
      const keypair = this.wallet.getKeypair();

      // Create Anchor provider with wallet adapter
      const wallet = {
        publicKey: keypair.publicKey,
        signTransaction: async <T extends Transaction | VersionedTransaction>(
          tx: T,
        ): Promise<T> => {
          if ('version' in tx) {
            // Versioned transaction
            (tx as VersionedTransaction).sign([keypair]);
          } else {
            // Legacy transaction
            (tx as Transaction).partialSign(keypair);
          }
          return tx;
        },
        signAllTransactions: async <T extends Transaction | VersionedTransaction>(
          txs: T[],
        ): Promise<T[]> => {
          return txs.map((tx) => {
            if ('version' in tx) {
              (tx as VersionedTransaction).sign([keypair]);
            } else {
              (tx as Transaction).partialSign(keypair);
            }
            return tx;
          });
        },
      };

      const provider = new AnchorProvider(this.connection, wallet as any, {
        commitment: 'confirmed',
      });
      setProvider(provider);

      // Initialize Portal program with IDL
      const portalProgramId = new PublicKey(this.solanaConfigService.portalProgramId);
      // Pass programId through the IDL object for Anchor v0.31
      const idlWithAddress = {
        ...portalIDL,
        address: portalProgramId.toString(),
      };
      this.portalProgram = new Program(idlWithAddress, provider);

      this.logger.log(`Portal program initialized at ${portalProgramId.toString()}`);
    } catch (error) {
      this.logger.error('Failed to initialize Portal program:', toError(error));
    }
  }

  private async buildTokenTransferInstructions(intent: Intent): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];

    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    const senderPublicKey = await this.wallet.getAddress();

    for (const token of intent.route.tokens) {
      try {
        // Denormalize token address to Solana format
        const tokenMint = new PublicKey(AddressNormalizer.denormalizeToSvm(token.token));

        // Get recipient from first call target (simplified - adjust based on your logic)
        const recipientAddress = intent.route.calls[0]?.target;
        if (!recipientAddress) continue;

        const recipientPublicKey = new PublicKey(
          AddressNormalizer.denormalizeToSvm(recipientAddress),
        );

        // Get or create associated token accounts
        const sourceTokenAccount = getAssociatedTokenAddressSync(
          tokenMint,
          senderPublicKey,
          false,
          TOKEN_PROGRAM_ID, // Try standard token program first
        );

        const destinationTokenAccount = getAssociatedTokenAddressSync(
          tokenMint,
          recipientPublicKey,
          false,
          TOKEN_PROGRAM_ID,
        );

        // Create transfer instruction
        const transferIx = createTransferInstruction(
          sourceTokenAccount,
          destinationTokenAccount,
          senderPublicKey,
          token.amount,
          [],
          TOKEN_PROGRAM_ID,
        );

        instructions.push(transferIx);
      } catch (error) {
        this.logger.warn(
          `Failed to create token transfer for ${token.token}: ${getErrorMessage(error)}`,
        );
      }
    }

    return instructions;
  }

  private prepareRouteData(route: Intent['route']): any {
    return {
      salt: Array.from(Buffer.from(route.salt.slice(2), 'hex')),
      deadline: new BN(route.deadline.toString()),
      portal: this.addressToBytes32(AddressNormalizer.denormalizeToSvm(route.portal)),
      tokens: route.tokens.map((t) => ({
        token: new PublicKey(AddressNormalizer.denormalizeToSvm(t.token)),
        amount: new BN(t.amount.toString()),
      })),
      calls: route.calls.map((c) => ({
        target: this.addressToBytes32(AddressNormalizer.denormalizeToSvm(c.target)),
        data: Array.from(Buffer.from(c.data.slice(2), 'hex')),
        value: new BN(c.value.toString()),
      })),
    };
  }

  private addressToBytes32(address: string): number[] {
    // Convert Solana address or hex address to 32-byte array
    if (address.startsWith('0x')) {
      return Array.from(Buffer.from(address.slice(2), 'hex'));
    }
    // For Solana base58 addresses, decode and pad/truncate to 32 bytes
    const publicKey = new PublicKey(address);
    const bytes = publicKey.toBytes();
    const result = new Uint8Array(32);
    result.set(bytes.slice(0, 32));
    return Array.from(result);
  }

  private publicKeyToBytes32(publicKey: PublicKey): number[] {
    const bytes = publicKey.toBytes();
    return Array.from(bytes);
  }
}
