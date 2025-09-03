import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';

import { ISvmWallet, SvmTransactionOptions } from '@/common/interfaces/svm-wallet.interface';
import { getErrorMessage } from '@/common/utils/error-handler';

/**
 * Basic wallet implementation for SVM using a Keypair
 */
export class BasicWallet implements ISvmWallet {
  readonly connection: Connection;
  private readonly keypair: Keypair;

  constructor(connection: Connection, keypair: Keypair) {
    this.connection = connection;
    this.keypair = keypair;
  }

  async getAddress(): Promise<PublicKey> {
    return this.keypair.publicKey;
  }

  getKeypair(): Keypair {
    return this.keypair;
  }

  async signTransaction(
    transaction: Transaction | VersionedTransaction,
  ): Promise<Transaction | VersionedTransaction> {
    if (transaction instanceof Transaction) {
      transaction.sign(this.keypair);
    } else {
      // For versioned transactions
      transaction.sign([this.keypair]);
    }
    return transaction;
  }

  async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    options?: SvmTransactionOptions,
  ): Promise<string> {
    try {
      if (transaction instanceof Transaction) {
        // For legacy transactions, use sendAndConfirmTransaction
        const signature = await sendAndConfirmTransaction(
          this.connection,
          transaction,
          [this.keypair],
          {
            commitment: options?.commitment || 'confirmed',
            preflightCommitment: options?.preflightCommitment || 'confirmed',
            skipPreflight: options?.skipPreflight || false,
            maxRetries: options?.maxRetries,
          },
        );
        return signature;
      } else {
        // For versioned transactions
        transaction.sign([this.keypair]);
        const signature = await this.connection.sendTransaction(transaction, {
          skipPreflight: options?.skipPreflight || false,
          preflightCommitment: options?.preflightCommitment || 'confirmed',
          maxRetries: options?.maxRetries,
        });

        // Wait for confirmation if not skipping
        if (!options?.skipPreflight) {
          await this.connection.confirmTransaction(signature, options?.commitment || 'confirmed');
        }

        return signature;
      }
    } catch (error) {
      throw new Error(`Failed to send transaction: ${getErrorMessage(error)}`);
    }
  }

  async getBalance(): Promise<bigint> {
    const balance = await this.connection.getBalance(this.keypair.publicKey);
    return BigInt(balance);
  }
}
