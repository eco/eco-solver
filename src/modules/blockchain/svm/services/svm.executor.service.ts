import { Injectable } from '@nestjs/common';

import { AnchorProvider, BN, Program, setProvider, web3 } from '@coral-xyz/anchor';
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
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
import { portalIdl } from '@/modules/blockchain/svm/targets/idl/portal.idl';
import { PortalIdl } from '@/modules/blockchain/svm/targets/types/portal-idl.type';
import { toBuffer } from '@/modules/blockchain/svm/utils/buffer';
import { addressToBytes32 } from '@/modules/blockchain/svm/utils/converter';
import { decodeSplTransferData } from '@/modules/blockchain/svm/utils/decode';
import { hashIntentSvm } from '@/modules/blockchain/svm/utils/hash';
import { getAnchorWallet } from '@/modules/blockchain/svm/utils/wallet-adapter';
import { BlockchainConfigService, SolanaConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';

import { SvmWalletManagerService } from './svm-wallet-manager.service';

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
      // The transaction is consuming ~395k CUs, so we'll set limit to 600k for safety margin
      const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 600_000,
      });

      const tokenTransferIxs = await this.generateTokenTransferInstructions(intent.route.calls);
      const fulfillIx = await this.generateFulfillIx(intent);

      // Build and send transaction
      const transaction = new Transaction()
        .add(computeBudgetIx)
        .add(...tokenTransferIxs)
        .add(fulfillIx);

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

  prepareRouteCalls(
    calls: Intent['route']['calls'],
    accounts: web3.AccountMeta[],
  ): Intent['route']['calls'] {
    // [data_length (4 bytes)][instruction_data (variable)][account_count (1 byte)]
    const sizeBytesLength = 4;

    return calls.map(({ target, data, value }, callIndex) => {
      const callDataBytes = Buffer.from(data.slice(2), 'hex');
      const dataLength = callDataBytes.readUInt32LE(0);
      const accountCount = callDataBytes[sizeBytesLength + dataLength];

      if (accountCount != accounts.length) {
        throw new Error(
          `Account count mismatch for call ${callIndex}: ${accountCount} != ${accounts.length}`,
        );
      }

      const accountsLength = Buffer.alloc(4);
      accountsLength.writeUInt32LE(accounts.length, 0);

      const accountsData = Buffer.concat(
        accounts.map((acc) => {
          // SerializableAccountMeta: { pubkey: [u8; 32], is_signer: bool, is_writable: bool }
          const pubkeyBytes = Buffer.from(acc.pubkey.toBytes());
          const isSignerByte = Buffer.from([acc.isSigner ? 1 : 0]);
          const isWritableByte = Buffer.from([acc.isWritable ? 1 : 0]);
          return Buffer.concat([pubkeyBytes, isSignerByte, isWritableByte]);
        }),
      );

      const serializedCalldata = Buffer.concat([callDataBytes, accountsLength, accountsData]);

      return {
        target,
        value,
        data: `0x${serializedCalldata.toString('hex')}` as Hex,
      };
    });
  }

  private async generateFulfillIx(intent: Intent) {
    const tokenAccounts = await this.getTokenAccounts(intent.route);
    const callAccounts = await this.getCallAccounts(intent.route);

    const svmIntent: Intent = {
      ...intent,
      route: {
        ...intent.route,
        calls: this.prepareRouteCalls(intent.route.calls, callAccounts),
      },
    };

    const hashes = hashIntentSvm(svmIntent);

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
      route: this.prepareRouteData(svmIntent.route),
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

  /**
   * Creates token transfer instructions for the intent's route tokens
   */
  private async generateTokenTransferInstructions(
    calls: Intent['route']['calls'],
  ): Promise<web3.TransactionInstruction[]> {
    const instructions: web3.TransactionInstruction[] = [];

    // Process each call in the route
    for (const call of calls) {
      // Check if this is an SPL token transfer
      if (this.isSPLTokenTransfer(call)) {
        const instruction = await this.createSPLTransferInstruction(call);
        instructions.push(instruction);
      }
    }

    return instructions;
  }

  /**
   * Checks if a call is an SPL token transfer
   */
  private isSPLTokenTransfer(call: Intent['route']['calls'][number]): boolean {
    const targetString = call.target.toString();
    const tokenProgramId = TOKEN_PROGRAM_ID.toBase58();

    if (targetString.toLowerCase() === tokenProgramId.toLowerCase()) {
      const dataBytes = toBuffer(call.data);
      // Check if it's a transfer instruction (instruction type 3)
      return dataBytes.length >= 9;
    }

    return false;
  }

  private async createSPLTransferInstruction(call: Intent['route']['calls'][number]) {
    // Decode the transfer amount from the call data
    const { amount } = decodeSplTransferData(call.data);
    const target = AddressNormalizer.denormalizeToSvm(call.target);
    const tokenMint = new web3.PublicKey(target);

    // Get source and destination token accounts
    const sourceTokenAccount = await getAssociatedTokenAddress(tokenMint, this.keypair.publicKey);

    // For now, use a placeholder recipient - this should come from the intent
    const recipientPubkey = new web3.PublicKey('DTrmsGNtx3ki5PxMwv3maBsHLZ2oLCG7LxqdWFBgBtqh');
    const destinationTokenAccount = await getAssociatedTokenAddress(tokenMint, recipientPubkey);

    // Check if destination token account exists, create if not
    const destAccountInfo = await this.connection.getAccountInfo(destinationTokenAccount);
    if (!destAccountInfo) {
      // Return instruction to create the associated token account
      return createAssociatedTokenAccountInstruction(
        this.keypair.publicKey,
        destinationTokenAccount,
        recipientPubkey,
        tokenMint,
      );
    }

    // Create the transfer instruction
    return createTransferInstruction(
      sourceTokenAccount,
      destinationTokenAccount,
      this.keypair.publicKey,
      Number(amount),
    );
  }

  private prepareRouteData(
    route: Intent['route'],
  ): Parameters<Program<PortalIdl>['methods']['fulfill']>[0]['route'] {
    return {
      salt: { 0: Array.from(toBuffer(route.salt)) },
      deadline: new BN(route.deadline.toString()),
      nativeAmount: new BN('0'),
      portal: { 0: addressToBytes32(AddressNormalizer.denormalizeToSvm(route.portal)) },
      tokens: route.tokens.map((t) => ({
        token: new PublicKey(AddressNormalizer.denormalizeToSvm(t.token)),
        amount: new BN(t.amount.toString()),
      })),
      calls: route.calls.map((c) => ({
        target: { 0: addressToBytes32(AddressNormalizer.denormalizeToSvm(c.target)) },
        data: toBuffer(c.data),
      })),
    };
  }

  private async getTokenAccounts(route: Intent['route']): Promise<web3.AccountMeta[]> {
    const accounts: web3.AccountMeta[] = [];

    // Add accounts for each token transfer
    // This needs to match VecTokenTransferAccounts structure from Rust
    for (const token of route.tokens) {
      const tokenMint = new web3.PublicKey(token.token);

      // Source token account (solver's)
      const sourceTokenAccount = await getAssociatedTokenAddress(tokenMint, this.keypair.publicKey);

      // Destination would be the executor PDA
      const [executorPda] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from('executor')],
        new web3.PublicKey(this.portalProgram!.idl.address),
      );

      const destTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        executorPda,
        true, // Allow PDA owner
      );

      // Add accounts in the order expected by the Rust TokenTransferAccounts struct:
      // [from, to, mint] - exactly 3 accounts per token
      accounts.push(
        { pubkey: sourceTokenAccount, isSigner: false, isWritable: true }, // from
        { pubkey: destTokenAccount, isSigner: false, isWritable: true }, // to
        { pubkey: tokenMint, isSigner: false, isWritable: false }, // mint
      );
    }

    return accounts;
  }

  private async getCallAccounts(route: Intent['route']): Promise<web3.AccountMeta[]> {
    // Add accounts for calls - these should be separate from token accounts
    const callAccounts: web3.AccountMeta[] = [];

    // Get executor PDA for call accounts
    const EXECUTOR_SEED = Buffer.from('executor');
    const [executorPda] = web3.PublicKey.findProgramAddressSync(
      [EXECUTOR_SEED],
      new web3.PublicKey(this.portalProgram!.idl.address),
    );

    for (const _call of route.calls) {
      // for token transfer calls we need 4 accounts:
      // 1. executor_ata (source) - writable
      // 2. token mint - read-only
      // 3. recipient_ata (destination) - writable
      // 4. executor PDA (authority) - read-only

      // Add all the call accounts as per the integration test pattern

      // For each token in the route, we need to provide call accounts
      for (const token of route.tokens) {
        const tokenMint = new web3.PublicKey(token.token);

        // Executor's associated token account (source)
        const executorAta = await getAssociatedTokenAddress(
          tokenMint,
          executorPda,
          true, // Allow PDA owner
        );

        // Recipient's associated token account (destination)
        // For now, using the solver's address as recipient - this should be parsed from call data
        // TODO: Change to correct recipient
        const recipientPubkey = this.keypair.publicKey;
        const recipientAta = await getAssociatedTokenAddress(tokenMint, recipientPubkey);

        // Add the 4 accounts needed for the call (matching integration test)
        callAccounts.push(
          { pubkey: executorAta, isSigner: false, isWritable: true }, // executor_ata (source)
          { pubkey: tokenMint, isSigner: false, isWritable: false }, // token mint
          { pubkey: recipientAta, isSigner: false, isWritable: true }, // recipient_ata (destination)
          { pubkey: executorPda, isSigner: false, isWritable: false }, // executor authority
        );
      }
    }

    return callAccounts;
  }
}
