import { Injectable, Optional } from '@nestjs/common';

import { web3 } from '@coral-xyz/anchor';
import * as api from '@opentelemetry/api';
import {
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
} from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Hex } from 'viem';

// Types for route and reward are now from the SVMIntent conversion
import { BaseChainReader } from '@/common/abstractions/base-chain-reader.abstract';
import { ChainInfo } from '@/common/interfaces/chain-info.interface';
import { Call, Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { getChainName } from '@/common/utils/chain-name.utils';
import { ChainType } from '@/common/utils/chain-type-detector';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { CalldataWithAccountsInstruction } from '@/modules/blockchain/svm/targets/types/portal-idl-coder.type';
import { decodeRouteCall } from '@/modules/blockchain/svm/utils/call-data';
import { bufferToBytes } from '@/modules/blockchain/svm/utils/converter';
import { portalBorshCoder } from '@/modules/blockchain/svm/utils/portal-borsh-coder';
import { SolanaConfigService } from '@/modules/config/services';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { SvmWalletManagerService } from './svm-wallet-manager.service';

@Injectable()
export class SvmReaderService extends BaseChainReader {
  private readonly connection: Connection;
  protected readonly logger: PinoLogger;

  constructor(
    @InjectPinoLogger(SvmReaderService.name)
    logger: PinoLogger,
    private solanaConfigService: SolanaConfigService,
    private readonly otelService: OpenTelemetryService,
    @Optional() private svmWalletManager?: SvmWalletManagerService,
  ) {
    super();
    this.logger = logger;
    const rpcUrl = this.solanaConfigService.rpcUrl;
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  async getChainInfo(chainId: number): Promise<ChainInfo> {
    const wallets = [];

    if (this.svmWalletManager) {
      try {
        const wallet = this.svmWalletManager.getWallet('basic', chainId);
        const address = await wallet.getAddress();
        wallets.push({
          type: 'basic',
          address: address.toString(),
        });
      } catch (error) {
        this.logger.error(`Failed to get SVM wallet: ${error}`);
      }
    }

    const tokens = this.solanaConfigService.getSupportedTokens();

    return {
      chainId,
      chainName: getChainName(chainId, ChainType.SVM),
      chainType: 'SVM',
      wallets,
      tokens: tokens.map((token) => ({
        address: AddressNormalizer.denormalize(token.address, ChainType.SVM),
        decimals: token.decimals,
        symbol: token.symbol,
      })),
    };
  }

  async getBalance(address: UniversalAddress, _chainId?: number): Promise<bigint> {
    return this.otelService.tracer.startActiveSpan(
      'svm.reader.getBalance',
      {
        attributes: {
          'svm.address': address,
          'svm.chain_id': _chainId?.toString() || 'solana',
          'svm.operation': 'getBalance',
        },
      },
      async (span) => {
        try {
          if (!this.connection) {
            throw new Error('Solana connection not initialized');
          }

          // Denormalize to Solana address format
          const svmAddress = AddressNormalizer.denormalize(address, ChainType.SVM);
          const publicKey = new PublicKey(svmAddress);

          span.setAttribute('svm.native_address', svmAddress);

          const balance = await this.connection.getBalance(publicKey);
          const balanceBigInt = BigInt(balance);

          span.setAttribute('svm.balance', balanceBigInt.toString());
          span.setStatus({ code: api.SpanStatusCode.OK });

          return balanceBigInt;
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  async getTokenBalance(
    tokenAddress: UniversalAddress,
    walletAddress: UniversalAddress,
    _chainId: number,
    allowOwnerOffCurve: boolean = false,
  ): Promise<bigint> {
    return this.otelService.tracer.startActiveSpan(
      'svm.reader.getTokenBalance',
      {
        attributes: {
          'svm.token_address': tokenAddress,
          'svm.wallet_address': walletAddress,
          'svm.chain_id': _chainId.toString(),
          'svm.allow_owner_off_curve': allowOwnerOffCurve,
          'svm.operation': 'getTokenBalance',
        },
      },
      async (span) => {
        try {
          if (!this.connection) {
            throw new Error('Solana connection not initialized');
          }

          // Denormalize to Solana address format
          const svmWalletAddress = AddressNormalizer.denormalizeToSvm(walletAddress);
          const svmTokenAddress = AddressNormalizer.denormalizeToSvm(tokenAddress);
          const walletPublicKey = new PublicKey(svmWalletAddress);
          const tokenMintPublicKey = new PublicKey(svmTokenAddress);

          // Get the associated token address for the wallet
          const associatedTokenAddress = await getAssociatedTokenAddress(
            tokenMintPublicKey,
            walletPublicKey,
            allowOwnerOffCurve, // Required for PDAs
          );

          // Get the token account balance
          const tokenBalance = await this.connection.getTokenAccountBalance(associatedTokenAddress);
          const balanceBigInt = BigInt(tokenBalance.value.amount);

          span.setAttributes({
            'svm.associated_token_address': associatedTokenAddress.toString(),
            'svm.token_balance': balanceBigInt.toString(),
          });

          span.setStatus({ code: api.SpanStatusCode.OK });
          return balanceBigInt;
        } catch (error) {
          // If the associated token account doesn't exist, return 0
          if (
            error instanceof TokenAccountNotFoundError ||
            getErrorMessage(error).includes('could not find account')
          ) {
            span.setAttribute('svm.account_not_found', true);
            span.setStatus({ code: api.SpanStatusCode.OK });
            return BigInt(0);
          }

          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  async isIntentFunded(intent: Intent, _chainId?: number): Promise<boolean> {
    return this.otelService.tracer.startActiveSpan(
      'svm.reader.isIntentFunded',
      {
        attributes: {
          'svm.intent_hash': intent.intentHash,
          'svm.chain_id': _chainId?.toString() || 'solana',
          'svm.operation': 'isIntentFunded',
          'svm.native_amount': intent.reward.nativeAmount.toString(),
          'svm.token_count': intent.reward.tokens.length,
        },
      },
      async (span) => {
        try {
          // Short circuit: if reward tokens array is empty and nativeAmount is 0, consider it funded
          if (intent.reward.tokens.length === 0 && intent.reward.nativeAmount === BigInt(0)) {
            this.logger.debug(
              `Intent ${intent.intentHash} has no reward requirements, considering it funded`,
            );
            span.setAttribute('svm.funding_status', 'no_requirements');
            span.setStatus({ code: api.SpanStatusCode.OK });
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
              span.setAttributes({
                'svm.funding_status': 'insufficient_native',
                'svm.required_native': intent.reward.nativeAmount.toString(),
                'svm.actual_native': vaultNativeBalance.toString(),
              });
              span.setStatus({ code: api.SpanStatusCode.OK });
              return false;
            }
          }

          // Check token balances by directly querying associated token accounts
          if (intent.reward.tokens.length > 0) {
            try {
              // Check each required reward token individually using the getTokenBalance method with retry
              for (const rewardToken of intent.reward.tokens) {
                if (rewardToken.amount > BigInt(0)) {
                  // Get the vault PDA address as a universal address
                  const vaultAddress = AddressNormalizer.normalizeSvm(vaultPDA);

                  const vaultTokenBalance = await this.getTokenBalance(
                    rewardToken.token,
                    vaultAddress,
                    Number(intent.sourceChainId),
                    true, // allowOwnerOffCurve - required for PDAs
                  );

                  this.logger.debug(
                    `Token ${AddressNormalizer.denormalize(rewardToken.token, ChainType.SVM)} balance: ${vaultTokenBalance}, required: ${rewardToken.amount}`,
                  );

                  if (vaultTokenBalance < rewardToken.amount) {
                    this.logger.debug(
                      `Intent ${intent.intentHash} requires ${rewardToken.amount} of token ${rewardToken.token} but vault only has ${vaultTokenBalance}`,
                    );
                    span.setAttributes({
                      'svm.funding_status': 'insufficient_token',
                      'svm.token_address': rewardToken.token,
                      'svm.required_amount': rewardToken.amount.toString(),
                      'svm.actual_amount': vaultTokenBalance.toString(),
                    });
                    span.setStatus({ code: api.SpanStatusCode.OK });
                    return false;
                  }
                }
              }
            } catch (error) {
              this.logger.error(
                `Failed to get token balances for vault ${vaultPDA.toBase58()}:`,
                toError(error),
              );
              // If we can't get token balances, assume no tokens are available
              if (intent.reward.tokens.some((token) => token.amount > BigInt(0))) {
                span.setAttributes({
                  'svm.funding_status': 'token_balance_error',
                  'svm.error_message': 'Could not retrieve token balances',
                });
                span.setStatus({ code: api.SpanStatusCode.OK });
                return false;
              }
            }
          }

          this.logger.debug(`Intent ${intent.intentHash} is fully funded`);
          span.setAttribute('svm.funding_status', 'funded');
          span.setStatus({ code: api.SpanStatusCode.OK });
          return true;
        } catch (error) {
          this.logger.error(
            `Failed to check intent funding for ${intent.intentHash}:`,
            toError(error),
          );
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw new Error(`Failed to check intent funding: ${getErrorMessage(error)}`);
        } finally {
          span.end();
        }
      },
    );
  }

  async getAccountInfo(address: string): Promise<any> {
    if (!this.connection) {
      throw new Error('Solana connection not initialized');
    }
    const publicKey = new PublicKey(address);
    return this.connection.getAccountInfo(publicKey);
  }

  async isTransactionConfirmed(signature: string): Promise<boolean> {
    return this.otelService.tracer.startActiveSpan(
      'svm.reader.isTransactionConfirmed',
      {
        attributes: {
          'svm.signature': signature,
          'svm.operation': 'isTransactionConfirmed',
        },
      },
      async (span) => {
        try {
          const signatureStatus = await this.connection.getSignatureStatus(signature);
          const isConfirmed = signatureStatus?.value?.confirmationStatus === 'finalized';

          span.setAttributes({
            'svm.confirmation_status': signatureStatus?.value?.confirmationStatus || 'unknown',
            'svm.is_confirmed': isConfirmed,
          });

          span.setStatus({ code: api.SpanStatusCode.OK });
          return isConfirmed;
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
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
    return this.otelService.tracer.startActiveSpan(
      'svm.reader.fetchProverFee',
      {
        attributes: {
          'svm.chain_id': chainId?.toString() || 'solana',
          'svm.intent_hash': intent.intentHash,
          'svm.prover_address': prover,
          'svm.operation': 'fetchProverFee',
          'svm.has_claimant': !!claimant,
        },
      },
      (span) => {
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
      },
    );
  }

  async validateTokenTransferCall(
    call: Intent['route']['calls'][number],
    chainId: number,
  ): Promise<boolean> {
    return this.otelService.tracer.startActiveSpan(
      'svm.reader.validateTokenTransferCall',
      {
        attributes: {
          'svm.operation': 'validateTokenTransferCall',
          'svm.target': call.target,
          'svm.chain_id': chainId.toString(),
          'svm.value': call.value.toString(),
        },
      },
      (span) => {
        try {
          // First, validate that the target is the TOKEN_PROGRAM_ID
          // In Solana, token transfers are made to the TOKEN_PROGRAM_ID, not the token mint address
          const tokenProgramAddress = AddressNormalizer.normalizeSvm(TOKEN_PROGRAM_ID);

          span.setAttribute('svm.expected_target', tokenProgramAddress);
          span.setAttribute('svm.actual_target', call.target);

          if (call.target !== tokenProgramAddress) {
            throw new Error(
              `Invalid Solana token transfer target: expected TOKEN_PROGRAM_ID (${tokenProgramAddress}), got ${call.target}`,
            );
          }

          const { calldata, accounts } = decodeRouteCall(call);

          // Basic sanity check - Solana token instructions should have reasonable length
          if (calldata.data.length < 1) {
            throw new Error('Invalid Solana instruction: call data too short');
          }

          if (calldata.account_count !== accounts.length) {
            throw new Error('Invalid count of accounts for call');
          }

          // Parse the instruction discriminator (first byte)
          // Solana SPL Token instruction discriminators:
          // - Transfer: 3
          // - TransferChecked: 12
          const instructionType = calldata.data[0];

          span.setAttribute('svm.instruction_type', instructionType);
          span.setAttribute('svm.call_data_length', calldata.data.length);

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

          return this.validateTokenProgramAccounts(instructionType, accounts).then(
            (areValidAccounts) => {
              span.setAttribute('svm.are_valid_accounts', areValidAccounts);

              if (!areValidAccounts) {
                throw new Error('Invalid accounts for transfer');
              }

              span.setAttribute('svm.validation_result', 'token_transfer_validated');
              span.setStatus({ code: api.SpanStatusCode.OK });

              this.logger.debug(
                `Solana token transfer validation passed for target ${call.target}. ` +
                  `Instruction type: ${isTransferInstruction ? 'Transfer' : 'TransferChecked'}`,
              );

              return true;
            },
          );
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw new Error(
            `Invalid Solana token instruction for target ${call.target}: ${getErrorMessage(error)}`,
          );
        } finally {
          span.end();
        }
      },
    );
  }

  buildTokenTransferCalldata(
    recipient: UniversalAddress,
    tokenAddr: UniversalAddress,
    amount: bigint,
  ): Call {
    const token = this.solanaConfigService.getTokenConfig(
      this.solanaConfigService.chainId,
      tokenAddr,
    );

    const svmTokenAddress = AddressNormalizer.denormalizeToSvm(token.address);
    const svmRecipientAddress = AddressNormalizer.denormalizeToSvm(recipient);

    const recipientPubkey = new PublicKey(svmRecipientAddress);
    const tokenMintPubkey = new PublicKey(svmTokenAddress);
    const portalProgramPubkey = new PublicKey(this.solanaConfigService.portalProgramId);

    // Get executor PDA for call accounts
    const EXECUTOR_SEED = Buffer.from('executor');
    const [executorPda] = web3.PublicKey.findProgramAddressSync(
      [EXECUTOR_SEED],
      portalProgramPubkey,
    );

    // For SPL token transfers, we need to get the associated token accounts
    // Using the synchronous version to avoid async in this method
    const sourceATA = getAssociatedTokenAddressSync(
      tokenMintPubkey,
      executorPda,
      true, // allowOwnerOffCurve for PDAs
    );

    const destinationATA = getAssociatedTokenAddressSync(
      tokenMintPubkey,
      recipientPubkey,
      true, // allowOwnerOffCurve for PDAs
    );

    // Create the Calldata struct exactly as in the integration test
    const calldata = createTransferCheckedInstruction(
      sourceATA,
      tokenMintPubkey,
      destinationATA,
      executorPda,
      amount,
      token.decimals,
    );

    // Since Portal's executor executes transfers and it's a Program. It's not an ix signer.
    calldata.keys[3].isSigner = false;

    // Create the accounts structure
    const accounts: CalldataWithAccountsInstruction['accounts'] = calldata.keys.map((key) => ({
      pubkey: key.pubkey,
      is_signer: key.isSigner,
      is_writable: key.isWritable,
    }));

    // Encode the calldata with accounts using the Portal's borsh coder
    const encodedData = portalBorshCoder.types.encode<CalldataWithAccountsInstruction>(
      'CalldataWithAccounts',
      {
        calldata: {
          data: calldata.data,
          account_count: calldata.keys.length,
        },
        accounts,
      },
    );

    // For Solana, token transfers go to the TOKEN_PROGRAM_ID
    const tokenProgramAddress = AddressNormalizer.normalizeSvm(TOKEN_PROGRAM_ID);

    return {
      target: tokenProgramAddress,
      data: bufferToBytes(encodedData),
      value: 0n,
    };
  }

  /**
   *  Validate accounts for the Transfer and TransferChecked functions of the Token Program.
   *
   * @param instructionType Instruction type (3 = Transfer, 12 = TransferChecked)
   * @param accounts Accounts
   * @private
   */
  private async validateTokenProgramAccounts(
    instructionType: number,
    accounts: web3.AccountMeta[],
  ) {
    switch (instructionType) {
      case 3: {
        // Transfer accounts: [source, destination, authority]
        const [sourceAcctMeta] = accounts;
        return this.validateATAAccount(sourceAcctMeta.pubkey);
      }
      case 12:
        // TransferChecked accounts: [source, mint, destination, authority]
        const [sourceAcctMeta] = accounts;
        return this.validateATAAccount(sourceAcctMeta.pubkey);

      default:
        throw new Error(`Invalid Token program instruction: ${instructionType}`);
    }
  }

  private async validateATAAccount(ataAccount: web3.PublicKey) {
    try {
      return await this.validateExistingATAAccount(ataAccount);
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        return this.validateNonExistingATAAccount(ataAccount);
      }
      throw new Error('Unable to validate ATAAccount: ' + getErrorMessage(error));
    }
  }

  private async validateExistingATAAccount(ataAccount: web3.PublicKey) {
    // Get mint from the source account
    const { owner, mint } = await getAccount(this.connection, ataAccount);

    const portalProgramId = new PublicKey(this.solanaConfigService.portalProgramId);
    const [executorPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('executor')],
      portalProgramId,
    );

    const isValidOwnerAccount = executorPda.equals(owner);

    const isTokenSupported = this.solanaConfigService.isTokenSupported(
      this.solanaConfigService.chainId,
      AddressNormalizer.normalizeSvm(mint),
    );

    return isTokenSupported && isValidOwnerAccount;
  }

  private async validateNonExistingATAAccount(ataAccount: web3.PublicKey) {
    const validATAs = await this.getPortalExecutorATAs();
    return validATAs.some((ata) => ata.equals(ataAccount));
  }

  private async getPortalExecutorATAs(): Promise<web3.PublicKey[]> {
    // TODO: Cache this function

    // Owner must be the Portal program
    const portal = new PublicKey(this.solanaConfigService.portalProgramId);
    const [executorPda] = web3.PublicKey.findProgramAddressSync([Buffer.from('executor')], portal);

    const tokens = this.solanaConfigService.getSupportedTokens();
    const accountPromises = tokens.map((token) => {
      const tokenAddr = AddressNormalizer.denormalizeToSvm(token.address);
      const tokenMint = new web3.PublicKey(tokenAddr);
      return getAssociatedTokenAddress(tokenMint, executorPda, true);
    });

    return Promise.all(accountPromises);
  }
}
