import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import {
  getAccount,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';
import { Hex } from 'viem';

// Types for route and reward are now from the SVMIntent conversion
import { BaseChainReader } from '@/common/abstractions/base-chain-reader.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType } from '@/common/utils/chain-type-detector';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { BlockchainConfigService, SolanaConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

@Injectable()
export class SvmReaderService extends BaseChainReader {
  private readonly connection: Connection;

  constructor(
    private solanaConfigService: SolanaConfigService,
    protected readonly logger: SystemLoggerService,
    private readonly blockchainConfigService: BlockchainConfigService,
    private readonly otelService: OpenTelemetryService,
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
      if (getErrorMessage(error).includes('could not find account')) {
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

      // Short circuit: if reward tokens array is empty and nativeAmount is 0, consider it funded
      if (intent.reward.tokens.length === 0 && intent.reward.nativeAmount === BigInt(0)) {
        this.logger.debug(
          `Intent ${intent.intentHash} has no reward requirements, considering it funded`,
        );
        return true;
      }

      // Get portal program ID
      const portalProgramId = new PublicKey(this.solanaConfigService.portalProgramId);

      // Derive vault PDA from intent hash
      const intentHashBuffer = Buffer.from(intent.intentHash.slice(2), 'hex');
      const [vaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), intentHashBuffer],
        portalProgramId,
      );

      // Check native SOL balance if nativeAmount is required
      if (intent.reward.nativeAmount > BigInt(0)) {
        const vaultNativeBalance = await this.connection.getBalance(vaultPDA);
        if (vaultNativeBalance < intent.reward.nativeAmount) {
          this.logger.debug(
            `Intent ${intent.intentHash} requires ${intent.reward.nativeAmount} lamports but vault only has ${vaultNativeBalance}`,
          );
          return false;
        }
      }

      // Check token balances by directly querying associated token accounts
      if (intent.reward.tokens.length > 0) {
        try {
          // Check each required reward token individually using associated token accounts
          for (const rewardToken of intent.reward.tokens) {
            if (rewardToken.amount > BigInt(0)) {
              // Denormalize the reward token address to Solana format
              const svmTokenAddress = AddressNormalizer.denormalize(
                rewardToken.token,
                ChainType.SVM,
              );
              const tokenMintPublicKey = new PublicKey(svmTokenAddress);

              // Get the associated token address for the vault (PDA requires allowOwnerOffCurve)
              const associatedTokenAddress = await getAssociatedTokenAddress(
                tokenMintPublicKey,
                vaultPDA,
                true, // allowOwnerOffCurve - required for PDAs
              );

              try {
                // Get the token balance directly
                // wait 10 seconds
                await new Promise((resolve) => setTimeout(resolve, 10000));
                const tokenBalance =
                  await this.connection.getTokenAccountBalance(associatedTokenAddress);
                const vaultTokenBalance = BigInt(tokenBalance.value.amount);

                this.logger.debug(
                  `Token ${svmTokenAddress} balance: ${vaultTokenBalance}, required: ${rewardToken.amount}`,
                );

                if (vaultTokenBalance < rewardToken.amount) {
                  this.logger.debug(
                    `Intent ${intent.intentHash} requires ${rewardToken.amount} of token ${rewardToken.token} but vault only has ${vaultTokenBalance}`,
                  );
                  return false;
                }
              } catch (tokenError) {
                // If the associated token account doesn't exist, balance is 0
                if (getErrorMessage(tokenError).includes('could not find account')) {
                  this.logger.debug(
                    `Token account for ${svmTokenAddress} not found, balance is 0, required: ${rewardToken.amount}`,
                  );
                  return false;
                } else {
                  throw tokenError;
                }
              }
            }
          }
        } catch (error) {
          this.logger.error(
            `Failed to get token accounts for vault ${vaultPDA.toBase58()}:`,
            toError(error),
          );
          // If we can't get token accounts, assume no tokens are available
          if (intent.reward.tokens.some((token) => token.amount > BigInt(0))) {
            return false;
          }
        }
      }

      this.logger.debug(`Intent ${intent.intentHash} is fully funded`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to check intent funding for ${intent.intentHash}:`, toError(error));
      throw new Error(`Failed to check intent funding: ${getErrorMessage(error)}`);
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

  /**
   * Fetches the prover fee for a Solana intent.
   *
   * Unlike EVM chains which have prover contracts with fetchFee functions,
   * Solana uses a different architecture where prover fees are handled
   * through the Portal program's prove instruction. Since there's no
   * equivalent fee-fetching contract interface on Solana, this method
   * returns a default fee of 0.
   *
   * @param intent - The intent to fetch the prover fee for
   * @param prover - The prover address (unused on Solana)
   * @param messageData - The message data (unused on Solana)
   * @param chainId - The chain ID (optional)
   * @param claimant - The claimant address (unused on Solana)
   * @returns Promise resolving to the prover fee (always 0 for Solana)
   */
  async fetchProverFee(
    intent: Intent,
    prover: UniversalAddress,
    messageData: Hex,
    chainId?: number | string,
    claimant?: UniversalAddress,
  ): Promise<bigint> {
    const span = this.otelService.startSpan('svm.reader.fetchProverFee', {
      attributes: {
        'svm.chain_id': chainId?.toString() || 'solana',
        'svm.intent_id': intent.intentHash,
        'svm.prover_address': prover,
        'svm.operation': 'fetchProverFee',
        'svm.has_claimant': !!claimant,
      },
    });

    try {
      // Solana doesn't have prover contracts with fetchFee functions like EVM
      // The Portal program handles proving through the 'prove' instruction
      // Return 0 as the default fee since there's no contract to query
      const defaultFee = BigInt(0);

      this.logger.debug(
        `Returning default prover fee (${defaultFee}) for Solana intent ${intent.intentHash}. ` +
          'Solana does not use prover contracts with fetchFee functions like EVM chains.',
      );

      span.setAttribute('svm.prover_fee', defaultFee.toString());
      span.setAttribute('svm.fee_source', 'default');
      span.setStatus({ code: api.SpanStatusCode.OK });

      return defaultFee;
    } catch (error) {
      this.logger.error(
        `Failed to fetch prover fee for Solana intent ${intent.intentHash}:`,
        toError(error),
      );
      span.recordException(toError(error));
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw new Error(`Failed to fetch prover fee: ${getErrorMessage(error)}`);
    } finally {
      span.end();
    }
  }
}
