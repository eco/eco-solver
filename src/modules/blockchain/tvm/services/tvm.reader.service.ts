import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { Hex } from 'viem';

import { BaseChainReader } from '@/common/abstractions/base-chain-reader.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { TvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { TvmTransportService } from './tvm-transport.service';

@Injectable()
export class TvmReaderService extends BaseChainReader {
  constructor(
    private transportService: TvmTransportService,
    private tvmConfigService: TvmConfigService,
    protected readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
  ) {
    super();
    this.logger.setContext(TvmReaderService.name);
  }

  async getBalance(address: string, chainId: number | string): Promise<bigint> {
    const span = this.otelService.startSpan('tvm.reader.getBalance', {
      attributes: {
        'tvm.chain_id': chainId.toString(),
        'tvm.address': address,
        'tvm.operation': 'getBalance',
      },
    });

    try {
      const client = this.transportService.getClient(chainId);
      
      // Convert base58 address to hex if needed
      const hexAddress = address.startsWith('T') 
        ? this.transportService.toHex(address)
        : address;
      
      // Get balance in SUN (1 TRX = 1,000,000 SUN)
      const balance = await client.trx.getBalance(hexAddress);
      const balanceBigInt = BigInt(balance);

      span.setAttribute('tvm.balance', balanceBigInt.toString());
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
      const client = this.transportService.getClient(chainId);
      
      // Convert addresses to hex if needed
      const hexTokenAddress = tokenAddress.startsWith('T') 
        ? this.transportService.toHex(tokenAddress)
        : tokenAddress;
      const hexWalletAddress = walletAddress.startsWith('T') 
        ? this.transportService.toHex(walletAddress)
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

  isAddressValid(address: string): boolean {
    return this.transportService.isValidAddress(address);
  }

  async isIntentFunded(intent: Intent, chainId: number | string): Promise<boolean> {
    const span = this.otelService.startSpan('tvm.reader.isIntentFunded', {
      attributes: {
        'tvm.chain_id': chainId.toString(),
        'tvm.intent_id': intent.intentHash,
        'tvm.operation': 'isIntentFunded',
        'tvm.source_chain': intent.route.source.toString(),
        'tvm.destination_chain': intent.route.destination.toString(),
      },
    });

    try {
      const intentSourceAddress = this.tvmConfigService.getIntentSourceAddress(chainId);
      if (!intentSourceAddress) {
        this.logger.warn(`No IntentSource address configured for chain ${chainId}`);
        span.setAttribute('tvm.intent_source_configured', false);
        span.setStatus({ code: api.SpanStatusCode.OK });
        span.end();
        return false;
      }

      span.setAttribute('tvm.intent_source_address', intentSourceAddress);
      const client = this.transportService.getClient(chainId);
      
      // Convert address to hex
      const hexIntentSourceAddress = intentSourceAddress.startsWith('T') 
        ? this.transportService.toHex(intentSourceAddress)
        : intentSourceAddress;

      // Prepare intent struct parameter for the contract call
      const intentParam = {
        route: {
          salt: intent.route.salt,
          source: intent.route.source.toString(),
          destination: intent.route.destination.toString(),
          inbox: this.transportService.toHex(intent.route.inbox),
          tokens: intent.route.tokens.map(token => ({
            token: this.transportService.toHex(token.token),
            amount: token.amount.toString(),
          })),
          calls: intent.route.calls.map(call => ({
            target: this.transportService.toHex(call.target),
            value: call.value.toString(),
            data: call.data,
          })),
        },
        reward: {
          creator: this.transportService.toHex(intent.reward.creator),
          prover: this.transportService.toHex(intent.reward.prover),
          deadline: intent.reward.deadline.toString(),
          nativeValue: intent.reward.nativeValue.toString(),
          tokens: intent.reward.tokens.map(token => ({
            token: this.transportService.toHex(token.token),
            amount: token.amount.toString(),
          })),
        },
      };

      // Call isIntentFunded on the IntentSource contract
      const parameter = [{ type: 'tuple', value: intentParam }];
      const result = await client.transactionBuilder.triggerConstantContract(
        hexIntentSourceAddress,
        'isIntentFunded(tuple)',
        {},
        parameter,
        hexIntentSourceAddress,
      );

      if (!result.result.result) {
        throw new Error('Failed to check intent funding status');
      }

      // Extract boolean result
      const isFunded = result.constant_result[0] === '0000000000000000000000000000000000000000000000000000000000000001';

      span.setAttribute('tvm.intent_funded', isFunded);
      span.setStatus({ code: api.SpanStatusCode.OK });
      return isFunded;
    } catch (error) {
      this.logger.error(`Failed to check if intent ${intent.intentHash} is funded:`, error);
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
        'tvm.intent_id': intent.intentHash,
        'tvm.prover_address': intent.reward.prover,
        'tvm.operation': 'fetchProverFee',
        'tvm.has_claimant': !!claimant,
      },
    });

    try {
      const client = this.transportService.getClient(chainId);
      
      // Convert addresses to hex
      const hexProverAddress = this.transportService.toHex(intent.reward.prover);
      const hexClaimantAddress = claimant ? this.transportService.toHex(claimant) : hexProverAddress;

      // Prepare parameters for fetchFee call
      const parameters = [
        { type: 'bytes32', value: intent.route.salt },
        { type: 'uint256', value: intent.route.source.toString() },
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
      this.logger.error(`Failed to fetch prover fee for intent ${intent.intentHash}:`, error);
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw new Error(`Failed to fetch prover fee: ${error.message}`);
    } finally {
      span.end();
    }
  }
}