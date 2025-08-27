import { Injectable } from '@nestjs/common';

import { getAccount, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';
import { Address, Hex } from 'viem';

import { Reward, Route } from '@/common/abis/portal.abi';
import { BaseChainReader } from '@/common/abstractions/base-chain-reader.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';
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

  async getBalance(address: string, _chainId?: number | string): Promise<bigint> {
    if (!this.connection) {
      throw new Error('Solana connection not initialized');
    }
    const publicKey = new PublicKey(address);
    const balance = await this.connection.getBalance(publicKey);
    return BigInt(balance);
  }

  async getTokenBalance(
    tokenAddress: string,
    walletAddress: string,
    _chainId: number | string,
  ): Promise<bigint> {
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

  async isIntentFunded(intent: Intent, _chainId?: number | string): Promise<boolean> {
    try {
      // Get source chain info for vault derivation
      if (!intent.sourceChainId) {
        throw new Error(`Intent ${intent.intentHash} is missing required sourceChainId`);
      }
      const sourceChainId = intent.sourceChainId;
      const sourceChainType = ChainTypeDetector.detect(sourceChainId);
      const destChainType = ChainTypeDetector.detect(intent.destination);

      // Calculate intent hash for vault derivation
      const intentHash = PortalHashUtils.computeIntentHash(
        intent.destination,
        intent.route as Route,
        intent.reward as Reward,
        sourceChainType,
        destChainType,
      );

      // Get portal program ID from config
      const portalProgramAddress = this.blockchainConfigService.getPortalAddress(sourceChainId);
      const portalProgramId = new PublicKey(portalProgramAddress);

      // Derive vault PDA
      const vaultPDA = PortalHashUtils.deriveVaultPDA(
        Buffer.from(intentHash.slice(2), 'hex'),
        portalProgramId,
      );

      this.logger.debug(
        `Checking vault funding for intent ${intent.intentHash} at ${vaultPDA.toString()}`,
      );

      // Check native balance first
      const requiredNativeAmount = intent.reward.nativeAmount || 0n;
      if (requiredNativeAmount > 0n) {
        const nativeBalance = await this.getBalance(vaultPDA.toString());
        if (nativeBalance < requiredNativeAmount) {
          this.logger.debug(
            `Vault ${vaultPDA.toString()} has insufficient SOL: required ${requiredNativeAmount}, actual ${nativeBalance}`,
          );
          return false;
        }
      }

      // Check token balances
      if (intent.reward.tokens && intent.reward.tokens.length > 0) {
        for (const token of intent.reward.tokens) {
          const tokenBalance = await this.getTokenBalance(
            token.token,
            vaultPDA.toString(),
            _chainId,
          );

          if (tokenBalance < token.amount) {
            this.logger.debug(
              `Vault has insufficient token balance for ${token.token}: required ${token.amount}, actual ${tokenBalance}`,
            );
            return false;
          }
        }
      }

      this.logger.debug(`Intent ${intent.intentHash} is fully funded`);
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
    _messageData: Hex,
    _chainId?: number | string,
    _claimant?: Address,
  ): Promise<bigint> {
    // Solana doesn't have prover contracts yet
    // This is a stub implementation
    this.logger.warn('Prover fee fetching not implemented for Solana');
    throw new Error('Prover fee fetching not implemented for Solana');
  }
}
