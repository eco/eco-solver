import { Injectable, Logger } from '@nestjs/common';

import { getAccount, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';
import { Hex } from 'viem';

import { BaseChainReader } from '@/common/abstractions/base-chain-reader.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { SolanaConfigService } from '@/modules/config/services';

@Injectable()
export class SvmReaderService extends BaseChainReader {
  protected readonly logger = new Logger(SvmReaderService.name);
  private readonly connection: Connection;

  constructor(private solanaConfigService: SolanaConfigService) {
    super();
    const rpcUrl = this.solanaConfigService.rpcUrl;
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  async getBalance(address: string): Promise<bigint> {
    if (!this.connection) {
      throw new Error('Solana connection not initialized');
    }
    const publicKey = new PublicKey(address);
    const balance = await this.connection.getBalance(publicKey);
    return BigInt(balance);
  }

  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<bigint> {
    if (!this.connection) {
      throw new Error('Solana connection not initialized');
    }
    try {
      const walletPublicKey = new PublicKey(walletAddress);
      const tokenMintPublicKey = new PublicKey(tokenAddress);

      // Get the associated token address for the wallet
      const associatedTokenAddress = getAssociatedTokenAddressSync(
        tokenMintPublicKey,
        walletPublicKey,
      );

      // Get the token account info
      const tokenAccount = await getAccount(this.connection, associatedTokenAddress);

      return BigInt(tokenAccount.amount.toString());
    } catch (error) {
      // If the associated token account doesn't exist, return 0
      if (error.message?.includes('could not find account')) {
        return BigInt(0);
      }
      throw error;
    }
  }

  isAddressValid(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  async isIntentFunded(_intent: Intent): Promise<boolean> {
    // Solana doesn't have IntentSource contracts
    // Always return true for now
    this.logger.debug('Intent funding check not implemented for Solana');
    return true;
  }

  async getBlockHeight(): Promise<bigint> {
    if (!this.connection) {
      throw new Error('Solana connection not initialized');
    }
    const blockHeight = await this.connection.getBlockHeight();
    return BigInt(blockHeight);
  }

  async getAccountInfo(address: string): Promise<any> {
    if (!this.connection) {
      throw new Error('Solana connection not initialized');
    }
    const publicKey = new PublicKey(address);
    return this.connection.getAccountInfo(publicKey);
  }

  async getTransaction(signature: string): Promise<any> {
    if (!this.connection) {
      throw new Error('Solana connection not initialized');
    }
    return this.connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
  }

  async isTransactionConfirmed(signature: string): Promise<boolean> {
    const signatureStatus = await this.connection.getSignatureStatus(signature);
    return signatureStatus?.value?.confirmationStatus === 'finalized';
  }

  async fetchProverFee(_intent: Intent, messageData: Hex): Promise<bigint> {
    // Solana doesn't have prover contracts yet
    // This is a stub implementation
    this.logger.warn('Prover fee fetching not implemented for Solana');
    throw new Error('Prover fee fetching not implemented for Solana');
  }
}
