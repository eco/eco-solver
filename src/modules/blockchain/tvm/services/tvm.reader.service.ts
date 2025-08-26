import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { TronWeb } from 'tronweb';
import { Hex } from 'viem';

import { BaseChainReader } from '@/common/abstractions/base-chain-reader.abstract';
import { Call, Intent, TokenAmount } from '@/common/interfaces/intent.interface';
import { ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';
import { BlockchainConfigService, TvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { TvmClientUtils, TvmErrorHandler } from '../utils';

import { TvmUtilsService } from './tvm-utils.service';

@Injectable()
export class TvmReaderService extends BaseChainReader {
  constructor(
    private utilsService: TvmUtilsService,
    private tvmConfigService: TvmConfigService,
    protected readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    private readonly blockchainConfigService: BlockchainConfigService,
  ) {
    super();
    this.logger.setContext(TvmReaderService.name);
  }

  /**
   * Gets the native token balance for an address
   * @param address - The address to check (base58 or hex format)
   * @param chainId - The chain ID to query
   * @returns The balance in SUN (smallest unit)
   */
  async getBalance(address: string, chainId: number | string): Promise<bigint> {
    const span = this.otelService.startSpan('tvm.reader.getBalance', {
      attributes: {
        'tvm.chain_id': chainId.toString(),
        'tvm.address': address,
        'tvm.operation': 'getBalance',
      },
    });

    try {
      const balance = await TvmErrorHandler.wrapAsync(
        async () => {
          const client = this.createTronWebClient(chainId);

          // Convert base58 address to hex if needed
          const hexAddress = address.startsWith('T') ? this.utilsService.toHex(address) : address;

          // Get balance in SUN (1 TRX = 1,000,000 SUN)
          const balance = await client.trx.getBalance(hexAddress);
          const balanceBigInt = BigInt(balance);

          span.setAttribute('tvm.balance', balanceBigInt.toString());
          span.setStatus({ code: api.SpanStatusCode.OK });
          return balanceBigInt;
        },
        { operation: 'getBalance', chainId, address },
        span,
        this.logger,
      );

      return balance;
    } finally {
      span.end();
    }
  }

  async getTokenBalance(
    tokenAddress: string,
    walletAddress: string,
    chainId: number | string,
  ): Promise<bigint> {
    const span = this.otelService.startSpan('tvm.reader.getTokenBalance', {
      attributes: {
        'tvm.chain_id': chainId.toString(),
        'tvm.token_address': tokenAddress,
        'tvm.wallet_address': walletAddress,
        'tvm.operation': 'getTokenBalance',
      },
    });

    try {
      const client = this.createTronWebClient(chainId);

      // Convert addresses to hex if needed
      const hexTokenAddress = tokenAddress.startsWith('T')
        ? this.utilsService.toHex(tokenAddress)
        : tokenAddress;
      const hexWalletAddress = walletAddress.startsWith('T')
        ? this.utilsService.toHex(walletAddress)
        : walletAddress;

      // Call TRC20 balanceOf function
      const parameter = [{ type: 'address', value: hexWalletAddress }];
      const result = await client.transactionBuilder.triggerConstantContract(
        hexTokenAddress,
        'balanceOf(address)',
        {},
        parameter,
        hexWalletAddress,
      );

      if (!result.result.result) {
        throw new Error('Failed to get token balance');
      }

      // Extract balance from the result
      const balance = result.constant_result[0];
      const balanceBigInt = BigInt('0x' + balance);

      span.setAttribute('tvm.token_balance', balanceBigInt.toString());
      span.setStatus({ code: api.SpanStatusCode.OK });
      return balanceBigInt;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Validates if the given address is a valid Tron address
   * @param address - The address to validate
   * @returns true if valid Tron address, false otherwise
   */
  isAddressValid(address: string): boolean {
    return this.utilsService.isValidAddress(address);
  }

  /**
   * Checks if an intent is funded by checking vault balances
   * @param intent - The intent to check
   * @param chainId - The chain ID to query
   * @returns True if the intent is funded, false otherwise
   */
  async isIntentFunded(intent: Intent, chainId: number | string): Promise<boolean> {
    const span = this.otelService.startSpan('tvm.reader.isIntentFunded', {
      attributes: {
        'tvm.chain_id': chainId.toString(),
        'tvm.intent_id': intent.intentId,
        'tvm.operation': 'isIntentFunded',
        'tvm.destination_chain': intent.destination.toString(),
      },
    });

    try {
      // Get source chain info for vault derivation
      if (!intent.sourceChainId) {
        throw new Error(`Intent ${intent.intentId} is missing required sourceChainId`);
      }
      const sourceChainId = intent.sourceChainId;
      const sourceChainType = ChainTypeDetector.detect(sourceChainId);
      const destChainType = ChainTypeDetector.detect(intent.destination);

      // Calculate intent hash for vault derivation
      const intentHash = PortalHashUtils.computeIntentHash(
        intent.destination,
        {
          ...intent.route,
          tokens: [...intent.route.tokens] as TokenAmount[],
          calls: [...intent.route.calls] as Call[],
        },
        {
          ...intent.reward,
          tokens: [...intent.reward.tokens] as TokenAmount[],
        },
        sourceChainType,
        destChainType,
      );

      // Get portal address from config
      const portalAddress = this.blockchainConfigService.getPortalAddress(sourceChainId);

      // Derive vault address
      const vaultAddress = PortalHashUtils.getVaultAddress(
        sourceChainType,
        sourceChainId,
        intentHash,
        portalAddress,
      );

      span.setAttribute('tvm.vault_address', vaultAddress);
      span.setAttribute('tvm.intent_hash', intentHash);

      // Check native balance first
      const requiredNativeAmount = intent.reward.nativeAmount || 0n;
      if (requiredNativeAmount > 0n) {
        const nativeBalance = await this.getBalance(vaultAddress, Number(sourceChainId));
        if (nativeBalance < requiredNativeAmount) {
          span.setAttribute('tvm.native_sufficient', false);
          span.setAttribute('tvm.native_required', requiredNativeAmount.toString());
          span.setAttribute('tvm.native_actual', nativeBalance.toString());
          span.setStatus({ code: api.SpanStatusCode.OK });
          return false;
        }
      }

      // Check token balances
      if (intent.reward.tokens && intent.reward.tokens.length > 0) {
        for (const token of intent.reward.tokens) {
          const tokenBalance = await this.getTokenBalance(
            token.token,
            vaultAddress,
            Number(sourceChainId),
          );

          if (tokenBalance < token.amount) {
            span.setAttribute('tvm.token_sufficient', false);
            span.setAttribute('tvm.token_address', token.token);
            span.setAttribute('tvm.token_required', token.amount.toString());
            span.setAttribute('tvm.token_actual', tokenBalance.toString());
            span.setStatus({ code: api.SpanStatusCode.OK });
            return false;
          }
        }
      }

      span.setAttribute('tvm.intent_funded', true);
      span.setStatus({ code: api.SpanStatusCode.OK });
      return true;
    } catch (error) {
      this.logger.error(`Failed to check if intent ${intent.intentId} is funded:`, error);
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw new Error(`Failed to check intent funding status: ${error.message}`);
    } finally {
      span.end();
    }
  }

  async fetchProverFee(
    intent: Intent,
    messageData: Hex,
    chainId: number | string,
    claimant?: string,
  ): Promise<bigint> {
    const span = this.otelService.startSpan('tvm.reader.fetchProverFee', {
      attributes: {
        'tvm.chain_id': chainId.toString(),
        'tvm.intent_id': intent.intentId,
        'tvm.prover_address': intent.reward.prover,
        'tvm.operation': 'fetchProverFee',
        'tvm.has_claimant': !!claimant,
      },
    });

    try {
      const client = this.createTronWebClient(chainId);

      // Convert addresses to hex
      const hexProverAddress = this.utilsService.toHex(intent.reward.prover);
      const hexClaimantAddress = claimant ? this.utilsService.toHex(claimant) : hexProverAddress;

      // Prepare parameters for fetchFee call
      const parameters = [
        { type: 'bytes32', value: intent.route.salt },
        { type: 'uint256', value: intent.sourceChainId.toString() },
        { type: 'bytes', value: messageData },
        { type: 'address', value: hexClaimantAddress },
      ];

      // Call fetchFee on the prover contract
      const result = await client.transactionBuilder.triggerConstantContract(
        hexProverAddress,
        'fetchFee(bytes32,uint256,bytes,address)',
        {},
        parameters,
        hexProverAddress,
      );

      if (!result.result.result) {
        throw new Error('Failed to fetch prover fee');
      }

      // Extract fee from the result
      const fee = result.constant_result[0];
      const feeBigInt = BigInt('0x' + fee);

      span.setAttribute('tvm.prover_fee', feeBigInt.toString());
      span.setStatus({ code: api.SpanStatusCode.OK });
      return feeBigInt;
    } catch (error) {
      this.logger.error(`Failed to fetch prover fee for intent ${intent.intentId}:`, error);
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw new Error(`Failed to fetch prover fee: ${error.message}`);
    } finally {
      span.end();
    }
  }

  /**
   * Creates a TronWeb instance for the given chain
   * @param chainId - The chain ID to create client for
   * @returns TronWeb instance
   */
  private createTronWebClient(chainId: number | string): TronWeb {
    const network = this.tvmConfigService.getChain(chainId);
    return TvmClientUtils.createClient(network);
  }
}
