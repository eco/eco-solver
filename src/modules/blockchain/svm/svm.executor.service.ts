import { Injectable } from '@nestjs/common';

import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';

import {
  BaseChainExecutor,
  ExecutionResult,
} from '@/common/abstractions/base-chain-executor.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { SolanaConfigService } from '@/modules/config/services';

@Injectable()
export class SvmExecutorService extends BaseChainExecutor {
  private connection: Connection;
  private keypair: Keypair;
  private programId: PublicKey;

  constructor(private solanaConfigService: SolanaConfigService) {
    super();
    this.initializeConnection();
  }

  private initializeConnection() {
    this.connection = new Connection(this.solanaConfigService.rpcUrl, 'confirmed');
    this.keypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(this.solanaConfigService.secretKey)),
    );
    this.programId = new PublicKey(this.solanaConfigService.programId);
  }

  async execute(intent: Intent, _walletId?: string): Promise<ExecutionResult> {
    try {
      // Create a simple transfer transaction as an example
      // In production, this would call the actual program instruction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.keypair.publicKey,
          toPubkey: new PublicKey(intent.route.inbox),
          lamports: Number(intent.reward.nativeValue),
        }),
      );

      // Add program instruction here for actual intent fulfillment
      // This is a placeholder for the actual program interaction

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
      console.error('Solana execution error:', error);
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
}
