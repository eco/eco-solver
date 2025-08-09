import { Injectable } from '@nestjs/common';

import { IMessageBridgeProverAbi, IntentSourceAbi } from '@eco-foundation/routes-ts';
import * as api from '@opentelemetry/api';
import { Address, erc20Abi, Hex, isAddress } from 'viem';

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
        'evm.intent_id': intent.intentHash,
        'evm.operation': 'isIntentFunded',
        'evm.source_chain': intent.route.source.toString(),
        'evm.destination_chain': intent.route.destination.toString(),
      },
    });

    try {
      const intentSourceAddress = this.evmConfigService.getIntentSourceAddress(chainId);
      if (!intentSourceAddress) {
        this.logger.warn(`No IntentSource address configured for chain ${chainId}`);
        span.setAttribute('evm.intent_source_configured', false);
        span.setStatus({ code: api.SpanStatusCode.OK });
        span.end();
        return false;
      }

      span.setAttribute('evm.intent_source_address', intentSourceAddress);
      const client = this.transportService.getPublicClient(chainId);

      // The isIntentFunded function expects the full Intent struct
      const isFunded = await client.readContract({
        address: intentSourceAddress,
        abi: IntentSourceAbi,
        functionName: 'isIntentFunded',
        args: [
          {
            route: {
              salt: intent.route.salt,
              source: intent.route.source,
              destination: intent.route.destination,
              inbox: intent.route.inbox,
              tokens: intent.route.tokens,
              calls: intent.route.calls,
            },
            reward: {
              creator: intent.reward.creator,
              prover: intent.reward.prover,
              deadline: intent.reward.deadline,
              nativeValue: intent.reward.nativeValue,
              tokens: intent.reward.tokens,
            },
          },
        ],
      });

      span.setAttribute('evm.intent_funded', isFunded);
      span.setStatus({ code: api.SpanStatusCode.OK });
      return isFunded as boolean;
    } catch (error) {
      this.logger.error(`Failed to check if intent ${intent.intentHash} is funded:`, error);
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
        'evm.intent_id': intent.intentHash,
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
          intent.route.source, // Source chain ID where the intent originates
          [intent.intentHash], // Empty intent hashes array for fee query
          [claimant], // Empty claimants array for fee query
          messageData, // Empty data parameter
        ],
      });

      span.setAttribute('evm.prover_fee', fee.toString());
      span.setStatus({ code: api.SpanStatusCode.OK });
      return fee as bigint;
    } catch (error) {
      this.logger.error(`Failed to fetch prover fee for intent ${intent.intentHash}:`, error);
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw new Error(`Failed to fetch prover fee: ${error.message}`);
    } finally {
      span.end();
    }
  }
}
