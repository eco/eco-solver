import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import {
  getAccount,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
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
import { SvmAddress } from '@/modules/blockchain/svm/types/address.types';
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

  async getBalance(address: UniversalAddress, _chainId?: number): Promise<bigint> {
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
    _chainId: number,
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

  async isIntentFunded(intent: Intent, _chainId?: number): Promise<boolean> {
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
    chainId?: number,
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

  async validateTokenTransferCall(
    call: Intent['route']['calls'][number],
    chainId: number,
  ): Promise<boolean> {
    const span = this.otelService.startSpan('svm.reader.validateTokenTransferCall', {
      attributes: {
        'svm.operation': 'validateTokenTransferCall',
        'svm.target': call.target,
        'svm.chain_id': chainId.toString(),
        'svm.value': call.value.toString(),
      },
    });

    try {
      // First, validate that the target is the TOKEN_PROGRAM_ID
      // In Solana, token transfers are made to the TOKEN_PROGRAM_ID, not the token mint address
      const tokenProgramAddress = AddressNormalizer.normalize(
        TOKEN_PROGRAM_ID.toBase58() as SvmAddress,
        ChainType.SVM,
      );

      span.setAttribute('svm.expected_target', tokenProgramAddress);
      span.setAttribute('svm.actual_target', call.target);

      if (call.target !== tokenProgramAddress) {
        throw new Error(
          `Invalid Solana token transfer target: expected TOKEN_PROGRAM_ID (${tokenProgramAddress}), got ${call.target}`,
        );
      }

      // Note: For Solana, we don't validate specific token addresses here because:
      // 1. All token transfers go through TOKEN_PROGRAM_ID (validated above)
      // 2. The specific token mint address would be specified in the accounts array of the transaction, not in the call target
      // 3. Token address validation would need to be done at a different level (transaction accounts validation)

      // Then, validate the Solana instruction data for token transfer
      if (!call.data || call.data === '0x') {
        throw new Error('Invalid Solana instruction: call data is empty');
      }

      // Remove '0x' prefix and convert to buffer
      const instructionData = Buffer.from(call.data.slice(2), 'hex');

      // Basic sanity check - Solana token instructions should have reasonable length
      if (instructionData.length < 1) {
        throw new Error('Invalid Solana instruction: call data too short');
      }

      // Parse the instruction discriminator (first byte)
      // Solana SPL Token instruction discriminators:
      // - Transfer: 3
      // - TransferChecked: 12
      const instructionType = instructionData[0];

      span.setAttribute('svm.instruction_type', instructionType);
      span.setAttribute('svm.call_data_length', instructionData.length);

      // Validate instruction type
      const isTransferInstruction = instructionType === 3; // Transfer
      const isTransferCheckedInstruction = instructionType === 12; // TransferChecked
      const isValidTokenTransfer = isTransferInstruction || isTransferCheckedInstruction;

      span.setAttributes({
        'svm.is_transfer': isTransferInstruction,
        'svm.is_transfer_checked': isTransferCheckedInstruction,
        'svm.is_valid_token_transfer': isValidTokenTransfer,
      });

      if (!isValidTokenTransfer) {
        throw new Error(
          `Invalid Solana token instruction: expected Transfer (3) or TransferChecked (12), got ${instructionType}`,
        );
      }

      // Additional validation based on instruction type
      if (isTransferInstruction) {
        // Transfer instruction should have exactly 8 bytes of data (discriminator + amount as u64)
        if (instructionData.length !== 9) {
          // 1 byte discriminator + 8 bytes amount
          throw new Error(
            `Invalid Transfer instruction: expected 9 bytes, got ${instructionData.length}`,
          );
        }
      } else if (isTransferCheckedInstruction) {
        // TransferChecked instruction should have exactly 9 bytes of data (discriminator + amount as u64 + decimals as u8)
        if (instructionData.length !== 10) {
          // 1 byte discriminator + 8 bytes amount + 1 byte decimals
          throw new Error(
            `Invalid TransferChecked instruction: expected 10 bytes, got ${instructionData.length}`,
          );
        }
      }

      span.setAttribute('svm.validation_result', 'token_transfer_validated');
      span.setStatus({ code: api.SpanStatusCode.OK });

      this.logger.debug(
        `Solana token transfer validation passed for target ${call.target}. ` +
          `Instruction type: ${isTransferInstruction ? 'Transfer' : 'TransferChecked'}`,
      );

      return true;
    } catch (error) {
      span.recordException(toError(error));
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw new Error(
        `Invalid Solana token instruction for target ${call.target}: ${getErrorMessage(error)}`,
      );
    } finally {
      span.end();
    }
  }
}
