import { Injectable } from '@nestjs/common';

import { getAccount, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';
import { Hex } from 'viem';

// Types for route and reward are now from the SVMIntent conversion
import { BaseChainReader } from '@/common/abstractions/base-chain-reader.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType } from '@/common/utils/chain-type-detector';
import { BlockchainConfigService, SolanaConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';

@Injectable()
export class SvmReaderService extends BaseChainReader {
  private readonly connection: Connection;

  constructor(
    private solanaConfigService: SolanaConfigService,
    protected readonly logger: SystemLoggerService,
    private readonly blockchainConfigService: BlockchainConfigService,
  ) {
    super();
    this.logger.setContext(SvmReaderService.name);
    const rpcUrl = this.solanaConfigService.rpcUrl;
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  async getBalance(address: UniversalAddress, _chainId?: number | string): Promise<bigint> {
    if (!this.connection) {
      throw new Error('Solana connection not initialized');
    }
    // Denormalize to Solana address format
    const svmAddress = AddressNormalizer.denormalize(address, ChainType.SVM);
    const publicKey = new PublicKey(svmAddress);
    const balance = await this.connection.getBalance(publicKey);
    return BigInt(balance);
  }

  async getTokenBalance(
    tokenAddress: UniversalAddress,
    walletAddress: UniversalAddress,
    _chainId: number | string,
  ): Promise<bigint> {
    if (!this.connection) {
      throw new Error('Solana connection not initialized');
    }
    try {
      // Denormalize to Solana address format
      const svmWalletAddress = AddressNormalizer.denormalize(walletAddress, ChainType.SVM);
      const svmTokenAddress = AddressNormalizer.denormalize(tokenAddress, ChainType.SVM);
      const walletPublicKey = new PublicKey(svmWalletAddress);
      const tokenMintPublicKey = new PublicKey(svmTokenAddress);

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

  async isIntentFunded(intent: Intent, _chainId?: number | string): Promise<boolean> {
    try {
      // Get source chain info for vault derivation
      if (!intent.sourceChainId) {
        throw new Error(`Intent ${intent.intentHash} is missing required sourceChainId`);
      }

      this.logger.debug(`Intent ${intent.intentHash} is fully funded`);

      return false;
      return true;
    } catch (error) {
      this.logger.error(`Failed to check intent funding for ${intent.intentHash}:`, error);
      throw new Error(`Failed to check intent funding: ${error.message}`);
    }
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

  async fetchProverFee(
    _intent: Intent,
    _prover: UniversalAddress,
    _messageData: Hex,
    _chainId?: number | string,
    _claimant?: UniversalAddress,
  ): Promise<bigint> {
    // Solana doesn't have prover contracts yet
    // This is a stub implementation
    this.logger.warn('Prover fee fetching not implemented for Solana');
    throw new Error('Prover fee fetching not implemented for Solana');
  }
}
