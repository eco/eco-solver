import { Injectable } from '@nestjs/common';
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { BaseChainExecutor, ExecutionResult } from '@/common/abstractions/base-chain-executor.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { SolanaChainConfig } from '@/common/interfaces/chain-config.interface';
import { SolanaConfigService } from '@/modules/config/services';

@Injectable()
export class SolanaExecutor extends BaseChainExecutor {
  private connection: Connection;
  private keypair: Keypair;
  private programId: PublicKey;

  constructor(private solanaConfigService: SolanaConfigService) {
    const config: SolanaChainConfig = {
      chainType: 'SVM',
      chainId: 'solana-mainnet',
      rpcUrl: solanaConfigService.rpcUrl,
      secretKey: JSON.parse(solanaConfigService.secretKey),
      programId: solanaConfigService.programId,
    };
    super(config);
    this.initializeConnection();
  }

  private initializeConnection() {
    const solanaConfig = this.config as SolanaChainConfig;
    
    this.connection = new Connection(solanaConfig.rpcUrl, 'confirmed');
    this.keypair = Keypair.fromSecretKey(
      Uint8Array.from(solanaConfig.secretKey)
    );
    this.programId = new PublicKey(solanaConfig.programId);
  }

  async execute(intent: Intent): Promise<ExecutionResult> {
    try {
      // Create a simple transfer transaction as an example
      // In production, this would call the actual program instruction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.keypair.publicKey,
          toPubkey: new PublicKey(intent.target),
          lamports: Number(intent.value),
        })
      );

      // Add program instruction here for actual intent fulfillment
      // This is a placeholder for the actual program interaction

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.keypair],
        {
          commitment: 'confirmed',
        }
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

  async getBalance(address: string): Promise<bigint> {
    const publicKey = new PublicKey(address);
    const balance = await this.connection.getBalance(publicKey);
    return BigInt(balance);
  }

  async isTransactionConfirmed(txHash: string): Promise<boolean> {
    try {
      const status = await this.connection.getSignatureStatus(txHash);
      return status.value?.confirmationStatus === 'confirmed' || 
             status.value?.confirmationStatus === 'finalized';
    } catch {
      return false;
    }
  }
}