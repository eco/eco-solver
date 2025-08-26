import { Injectable } from '@nestjs/common';

import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { Address, Hex } from 'viem';

import { Reward, Route } from '@/common/abis/portal.abi';
import {
  BaseChainExecutor,
  ExecutionResult,
} from '@/common/abstractions/base-chain-executor.abstract';
import { Call, Intent, TokenAmount } from '@/common/interfaces/intent.interface';
import { ChainType, ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { PortalEncoder } from '@/common/utils/portal-encoder';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';
import { SolanaConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { ProverService } from '@/modules/prover/prover.service';

@Injectable()
export class SvmExecutorService extends BaseChainExecutor {
  private readonly connection: Connection;
  private readonly keypair: Keypair;
  private readonly portalProgramId: PublicKey;

  constructor(
    private solanaConfigService: SolanaConfigService,
    private readonly logger: SystemLoggerService,
    private proverService: ProverService,
  ) {
    super();
    this.logger.setContext(SvmExecutorService.name);
    this.connection = new Connection(this.solanaConfigService.rpcUrl, 'confirmed');
    this.keypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(this.solanaConfigService.secretKey)),
    );
    this.portalProgramId = new PublicKey(this.solanaConfigService.portalProgramId);
  }

  async fulfill(intent: Intent, _walletId?: string): Promise<ExecutionResult> {
    if (!this.connection || !this.keypair || !this.portalProgramId) {
      throw new Error('Solana executor not initialized - missing configuration');
    }
    try {
      // Get source chain info for hash calculation
      if (!intent.sourceChainId) {
        throw new Error(`Intent ${intent.intentId} is missing required sourceChainId`);
      }
      const sourceChainId = intent.sourceChainId;
      const sourceChainType = ChainTypeDetector.detect(sourceChainId);
      const destChainType = ChainTypeDetector.detect(intent.destination);

      // Get prover and generate proof data
      const prover = this.proverService.getProver(Number(sourceChainId), intent.reward.prover);
      if (!prover) {
        throw new Error('Prover not found for intent fulfillment');
      }

      const proverAddr = prover.getContractAddress(Number(intent.destination));
      const proofData = await prover.generateProof(intent);

      // Calculate Portal hashes
      const intentHash = PortalHashUtils.computeIntentHash(
        intent.destination,
        intent.route as Route,
        intent.reward as Reward,
        sourceChainType,
        destChainType,
      );

      const rewardHash = PortalHashUtils.computeRewardHash(
        {
          ...intent.reward,
          tokens: [...intent.reward.tokens] as TokenAmount[],
        },
        sourceChainType,
      );

      // Derive PDAs (Program Derived Addresses)
      const intentHashBuffer = Buffer.from(intentHash.slice(2), 'hex');

      const [vaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), intentHashBuffer],
        this.portalProgramId,
      );

      const [fulfillMarkerPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('fulfill_marker'), intentHashBuffer],
        this.portalProgramId,
      );

      const [proverPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('prover'), Buffer.from(proverAddr!.slice(2), 'hex')],
        this.portalProgramId,
      );

      // Encode route for Solana using SVM encoding
      const routeEncoded = PortalEncoder.encodeForChain(
        {
          ...intent.route,
          tokens: [...intent.route.tokens] as TokenAmount[],
          calls: [...intent.route.calls] as Call[],
        },
        ChainType.SVM,
      );

      // Build Portal fulfillAndProve instruction
      const instruction = new TransactionInstruction({
        programId: this.portalProgramId,
        keys: [
          { pubkey: vaultPDA, isSigner: false, isWritable: true },
          { pubkey: fulfillMarkerPDA, isSigner: false, isWritable: true },
          { pubkey: proverPDA, isSigner: false, isWritable: false },
          { pubkey: this.keypair.publicKey, isSigner: true, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: this.encodeFulfillAndProveInstruction({
          intentHash: intentHashBuffer,
          route: routeEncoded,
          rewardHash: Buffer.from(rewardHash.slice(2), 'hex'),
          claimant: this.keypair.publicKey.toBuffer(),
          prover: proverAddr!,
          sourceChainId: Number(sourceChainId),
          proofData: Buffer.from(proofData.slice(2), 'hex'),
        }),
      });

      // Execute transaction with Portal instruction
      const transaction = new Transaction().add(instruction);

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.keypair],
        {
          commitment: 'confirmed',
        },
      );

      return {
        success: true,
        txHash: signature,
      };
    } catch (error) {
      this.logger.error('Solana execution error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getBalance(address: string, _chainId: number): Promise<bigint> {
    // Solana doesn't use numeric chain IDs, so we ignore the parameter
    const publicKey = new PublicKey(address);
    const balance = await this.connection.getBalance(publicKey);
    return BigInt(balance);
  }

  getWalletAddress(): Promise<Address> {
    return Promise.resolve(this.keypair.publicKey.toString() as Address);
  }

  async isTransactionConfirmed(txHash: string, _chainId: number): Promise<boolean> {
    // Solana doesn't use numeric chain IDs, so we ignore the parameter
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
    const intentHashBuffer = Buffer.from(intentHash.slice(2), 'hex');
    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), intentHashBuffer],
      this.portalProgramId,
    );
    return vaultPDA;
  }

  /**
   * Encodes fulfillAndProve instruction data for the Portal program
   * This is a simplified implementation - actual encoding would depend on the program's IDL
   */
  private encodeFulfillAndProveInstruction(params: {
    intentHash: Buffer;
    route: Buffer;
    rewardHash: Buffer;
    claimant: Buffer;
    prover: string;
    sourceChainId: number;
    proofData: Buffer;
  }): Buffer {
    // Instruction discriminator for fulfillAndProve (placeholder - would come from IDL)
    const discriminator = Buffer.from([0, 1, 2, 3, 4, 5, 6, 8]); // Different discriminator from fulfill

    // Source chain ID as 8-byte buffer (uint64)
    const sourceChainIdBuffer = Buffer.alloc(8);
    sourceChainIdBuffer.writeBigUInt64LE(BigInt(params.sourceChainId));

    // Prover address as 32-byte buffer (remove 0x prefix and convert to bytes)
    const proverBuffer = Buffer.from(params.prover.slice(2), 'hex');

    // Simple concatenation - actual encoding would use Borsh or similar
    return Buffer.concat([
      discriminator,
      params.intentHash,
      params.rewardHash,
      params.claimant,
      proverBuffer,
      sourceChainIdBuffer,
      params.proofData,
      params.route,
    ]);
  }
}
