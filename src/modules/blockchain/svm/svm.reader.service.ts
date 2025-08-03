import { Injectable } from '@nestjs/common';

import { Connection, PublicKey } from '@solana/web3.js';

import { SolanaConfigService } from '@/modules/config/services';

@Injectable()
export class SvmReaderService {
  private connection: Connection;

  constructor(private solanaConfigService: SolanaConfigService) {
    this.initializeConnection();
  }

  private initializeConnection() {
    const rpcUrl = this.solanaConfigService.rpcUrl;
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  async getBalance(address: string): Promise<bigint> {
    const publicKey = new PublicKey(address);
    const balance = await this.connection.getBalance(publicKey);
    return BigInt(balance);
  }

  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<bigint> {
    // This would require @solana/spl-token package
    // For now, returning a placeholder
    throw new Error('Token balance reading not yet implemented for Solana');
  }

  async getBlockHeight(): Promise<bigint> {
    const blockHeight = await this.connection.getBlockHeight();
    return BigInt(blockHeight);
  }

  async getAccountInfo(address: string): Promise<any> {
    const publicKey = new PublicKey(address);
    return this.connection.getAccountInfo(publicKey);
  }

  async getTransaction(signature: string): Promise<any> {
    return this.connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
  }

  async isTransactionConfirmed(signature: string): Promise<boolean> {
    const signatureStatus = await this.connection.getSignatureStatus(signature);
    return signatureStatus?.value?.confirmationStatus === 'finalized';
  }
}
