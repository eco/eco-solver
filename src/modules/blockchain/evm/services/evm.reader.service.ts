import { Injectable } from '@nestjs/common';

import { IMessageBridgeProverAbi } from '@eco-foundation/routes-ts';
import * as api from '@opentelemetry/api';
import { Address, erc20Abi, Hex, isAddress } from 'viem';

import { PortalAbi } from '@/common/abis/portal.abi';
import { BaseChainReader } from '@/common/abstractions/base-chain-reader.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
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
      // Get Portal address from config
      const portalAddress = this.evmConfigService.getPortalAddress(chainId);
      
      span.setAttributes({
        'portal.address': portalAddress,
        'portal.method': 'isIntentFunded_contract',
      });

      const client = this.transportService.getPublicClient(chainId);

      // Use Portal contract's isIntentFunded function
      // Construct the intent struct for the contract call
      const portalIntent = {
        destination: intent.destination,
        route: {
          salt: intent.route.salt,
          deadline: intent.route.deadline,
          portal: intent.route.portal,
          tokens: intent.route.tokens,
          calls: intent.route.calls,
        },
        reward: {
          deadline: intent.reward.deadline,
          creator: intent.reward.creator,
          prover: intent.reward.prover,
          nativeValue: intent.reward.nativeAmount, // Portal ABI uses nativeValue
          tokens: intent.reward.tokens,
        },
      };

      const isFunded = await client.readContract({
        address: portalAddress,
        abi: PortalAbi,
        functionName: 'isIntentFunded',
        args: [portalIntent],
      });

      span.setAttributes({
        'portal.intent_funded': isFunded,
      });
      span.setStatus({ code: api.SpanStatusCode.OK });
      
      return Boolean(isFunded);
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
      // Validate that sourceChainId is provided
      if (!intent.sourceChainId) {
        throw new Error(`Intent ${intent.intentId} is missing required sourceChainId`);
      }

      const client = this.transportService.getPublicClient(chainId);

      // Call fetchFee on the prover contract
      const fee = await client.readContract({
        address: intent.reward.prover,
        abi: IMessageBridgeProverAbi,
        functionName: 'fetchFee',
        args: [
          intent.sourceChainId, // Source chain ID where the intent originates - no fallback
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
