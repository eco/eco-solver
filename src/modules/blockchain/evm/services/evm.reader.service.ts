import { Injectable } from '@nestjs/common';

import { IMessageBridgeProverAbi } from '@eco-foundation/routes-ts';
import * as api from '@opentelemetry/api';
import { Address, erc20Abi, Hex, isAddress } from 'viem';

import { PORTAL_ADDRESSES } from '@/common/abis/portal.abi';
import { BaseChainReader } from '@/common/abstractions/base-chain-reader.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';
import { EvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { EvmTransportService } from './evm-transport.service';

@Injectable()
export class EvmReaderService extends BaseChainReader {
  constructor(
    private transportService: EvmTransportService,
    private evmConfigService: EvmConfigService,
    protected readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
  ) {
    super();
    this.logger.setContext(EvmReaderService.name);
  }

  async getBalance(address: string, chainId: number): Promise<bigint> {
    const span = this.otelService.startSpan('evm.reader.getBalance', {
      attributes: {
        'evm.chain_id': chainId,
        'evm.address': address,
        'evm.operation': 'getBalance',
      },
    });

    try {
      const client = this.transportService.getPublicClient(chainId);
      const balance = await client.getBalance({ address: address as Address });

      span.setAttribute('evm.balance', balance.toString());
      span.setStatus({ code: api.SpanStatusCode.OK });
      return balance;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  async getTokenBalance(
    tokenAddress: string,
    walletAddress: string,
    chainId: number,
  ): Promise<bigint> {
    const span = this.otelService.startSpan('evm.reader.getTokenBalance', {
      attributes: {
        'evm.chain_id': chainId,
        'evm.token_address': tokenAddress,
        'evm.wallet_address': walletAddress,
        'evm.operation': 'getTokenBalance',
      },
    });

    try {
      const client = this.transportService.getPublicClient(chainId);
      const balance = await client.readContract({
        address: tokenAddress as Address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [walletAddress as Address],
      });

      span.setAttribute('evm.token_balance', balance.toString());
      span.setStatus({ code: api.SpanStatusCode.OK });
      return balance as bigint;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  isAddressValid(address: string): boolean {
    return isAddress(address);
  }

  async isIntentFunded(intent: Intent, chainId: number): Promise<boolean> {
    const span = this.otelService.startSpan('evm.reader.isIntentFunded', {
      attributes: {
        'evm.chain_id': chainId,
        'evm.intent_id': intent.intentId,
        'evm.operation': 'isIntentFunded',
        'evm.source_chain': intent.sourceChainId?.toString(),
        'evm.destination_chain': intent.destination.toString(),
      },
    });

    try {
      // Get Portal address for the chain
      const portalAddress = PORTAL_ADDRESSES[chainId];
      if (!portalAddress) {
        this.logger.warn(`No Portal address configured for chain ${chainId}`);
        span.setAttribute('portal.configured', false);
        span.setStatus({ code: api.SpanStatusCode.OK });
        span.end();
        return false;
      }

      // Derive vault address for this intent
      const vaultAddress =
        intent.vaultAddress ||
        PortalHashUtils.getVaultAddress(
          ChainTypeDetector.detect(chainId),
          chainId,
          intent.intentId,
        );

      span.setAttributes({
        'portal.address': portalAddress,
        'vault.address': vaultAddress,
      });

      const client = this.transportService.getPublicClient(chainId);

      // Check native balance in vault
      const nativeBalance = await client.getBalance({ address: vaultAddress as Address });

      if (nativeBalance < intent.reward.nativeAmount) {
        span.setAttribute('vault.native_sufficient', false);
        span.setStatus({ code: api.SpanStatusCode.OK });
        return false;
      }

      // Check token balances in vault
      for (const token of intent.reward.tokens) {
        const tokenBalance = await client.readContract({
          address: token.token,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [vaultAddress as Address],
        });

        if ((tokenBalance as bigint) < token.amount) {
          span.setAttribute('vault.token_sufficient', false);
          span.setStatus({ code: api.SpanStatusCode.OK });
          return false;
        }
      }

      span.setAttributes({
        'vault.native_balance': nativeBalance.toString(),
        'vault.fully_funded': true,
      });
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

  // Original methods kept for backward compatibility
  async getBalanceForChain(chainId: number, address: Address): Promise<bigint> {
    const client = this.transportService.getPublicClient(chainId);
    return client.getBalance({ address });
  }

  async getTokenBalanceForChain(
    chainId: number,
    walletAddress: Address,
    tokenAddress: Address,
  ): Promise<bigint> {
    const client = this.transportService.getPublicClient(chainId);
    const balance = await client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [walletAddress],
    });

    return balance as bigint;
  }

  async fetchProverFee(
    intent: Intent,
    messageData: Hex,
    chainId: number,
    claimant?: Address,
  ): Promise<bigint> {
    const span = this.otelService.startSpan('evm.reader.fetchProverFee', {
      attributes: {
        'evm.chain_id': chainId,
        'evm.intent_id': intent.intentId,
        'evm.prover_address': intent.reward.prover,
        'evm.operation': 'fetchProverFee',
        'evm.has_claimant': !!claimant,
      },
    });

    try {
      const client = this.transportService.getPublicClient(chainId);

      // Call fetchFee on the prover contract
      const fee = await client.readContract({
        address: intent.reward.prover,
        abi: IMessageBridgeProverAbi,
        functionName: 'fetchFee',
        args: [
          intent.sourceChainId || 0n, // Source chain ID where the intent originates
          [intent.intentId], // Intent ID for fee query
          [claimant], // Claimant array for fee query
          messageData, // Message data parameter
        ],
      });

      span.setAttribute('evm.prover_fee', fee.toString());
      span.setStatus({ code: api.SpanStatusCode.OK });
      return fee as bigint;
    } catch (error) {
      this.logger.error(`Failed to fetch prover fee for intent ${intent.intentId}:`, error);
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw new Error(`Failed to fetch prover fee: ${error.message}`);
    } finally {
      span.end();
    }
  }
}
