import {
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  SendOptions,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';

/**
 * Transaction options for SVM operations
 */
export interface SvmTransactionOptions extends SendOptions {
  skipPreflight?: boolean;
  maxRetries?: number;
  commitment?: Commitment;
}

/**
 * Interface for SVM wallet implementations
 */
export interface ISvmWallet {
  /**
   * The Solana connection instance used by this wallet
   */
  readonly connection: Connection;

  /**
   * Gets the wallet's public key
   * @returns The wallet's public key
   */
  getAddress(): Promise<PublicKey>;

  /**
   * Gets the underlying keypair (for signing)
   * @returns The wallet's keypair
   */
  getKeypair(): Keypair;

  /**
   * Signs a transaction
   * @param transaction - The transaction to sign
   * @returns The signed transaction
   */
  signTransaction(
    transaction: Transaction | VersionedTransaction,
  ): Promise<Transaction | VersionedTransaction>;

  /**
   * Signs and sends a transaction
   * @param transaction - The transaction to send
   * @param options - Send options
   * @returns Transaction signature
   */
  sendTransaction(
    transaction: Transaction | VersionedTransaction,
    options?: SvmTransactionOptions,
  ): Promise<string>;

  /**
   * Gets the wallet's SOL balance
   * @returns Balance in lamports
   */
  getBalance(): Promise<bigint>;
}
