import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { TronWeb } from 'tronweb';
import { encodePacked, erc20Abi, Hex } from 'viem';

import { messageBridgeProverAbi } from '@/common/abis/message-bridge-prover.abi';
import { PortalAbi } from '@/common/abis/portal.abi';
import { BaseChainReader } from '@/common/abstractions/base-chain-reader.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType } from '@/common/utils/chain-type-detector';
import { TvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { TvmClientUtils, TvmErrorHandler } from '../utils';

import { TvmUtilsService } from './tvm-utils.service';

@Injectable()
export class TvmReaderService extends BaseChainReader {
  constructor(
    private tvmConfigService: TvmConfigService,
    protected readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
  ) {
    super();
    this.logger.setContext(TvmReaderService.name);
  }

  /**
   * Gets the native token balance for an address
   * @param address - The address to check (base58 or hex format)
   * @param chainId - The chain ID to query
   * @returns The balance in SUN (the smallest unit)
   */
  async getBalance(address: UniversalAddress, chainId: number | string): Promise<bigint> {
    // Denormalize to TVM address format
    const tvmAddress = AddressNormalizer.denormalize(address, ChainType.TVM);
    const span = this.otelService.startSpan('tvm.reader.getBalance', {
      attributes: {
        'tvm.chain_id': chainId.toString(),
        'tvm.address': address,
        'tvm.operation': 'getBalance',
      },
    });

    try {
      return await TvmErrorHandler.wrapAsync(
        async () => {
          const client = this.createTronWebClient(chainId);

          // Convert base58 address to hex if needed
          const hexAddress = tvmAddress.startsWith('T')
            ? TvmUtilsService.toHex(tvmAddress)
            : tvmAddress;

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
    } finally {
      span.end();
    }
  }

  async getTokenBalance(
    tokenAddress: UniversalAddress,
    walletAddress: UniversalAddress,
    chainId: number | string,
  ): Promise<bigint> {
    // Denormalize to TVM address format
    const tvmTokenAddress = AddressNormalizer.denormalize(tokenAddress, ChainType.TVM);
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
      const contract = client.contract(erc20Abi, tvmTokenAddress);

      // Call TRC20 balanceOf function
      const [balance] = await contract.balanceOf(tokenAddress).call();

      // Extract balance from the result
      const balanceBigInt = BigInt(balance);

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

  async isIntentFunded(intent: Intent, chainId: number): Promise<boolean> {
    const span = this.otelService.startSpan('tvm.reader.isIntentFunded', {
      attributes: {
        'tvm.chain_id': chainId,
        'tvm.intent_id': intent.intentHash,
        'tvm.operation': 'isIntentFunded',
        'tvm.source_chain': intent.sourceChainId?.toString(),
        'tvm.destination_chain': intent.destination.toString(),
      },
    });

    try {
      const client = this.createTronWebClient(chainId);

      const portalAddr = this.tvmConfigService.getPortalAddress(chainId);
      span.setAttribute('tvm.chain_id', chainId);
      span.setAttribute('tvm.portal_address', portalAddr);

      const contract = client.contract(PortalAbi, portalAddr);

      // Structure route data for TronWeb contract call
      const routeData: Parameters<typeof contract.isIntentFunded>[0][1] = [
        intent.route.salt,
        intent.route.deadline,
        AddressNormalizer.denormalizeToTvm(intent.route.portal),
        intent.route.nativeAmount,
        intent.route.tokens.map((t) => [AddressNormalizer.denormalizeToTvm(t.token), t.amount]),
        intent.route.calls.map((c) => [
          AddressNormalizer.denormalizeToTvm(c.target),
          c.data,
          c.value,
        ]),
      ];

      // Structure route data for TronWeb contract call
      const rewardData: Parameters<typeof contract.isIntentFunded>[0][2] = [
        intent.reward.deadline,
        intent.reward.creator,
        intent.reward.prover,
        intent.reward.nativeAmount,
        intent.reward.tokens.map((t) => [AddressNormalizer.denormalizeToTvm(t.token), t.amount]),
      ];

      const intentParam: Parameters<typeof contract.isIntentFunded>[0] = [
        intent.destination,
        routeData,
        rewardData,
      ];

      // Call TRC20 balanceOf function
      const isFunded = await contract.isIntentFunded(intentParam).call();

      span.setAttributes({
        'portal.intent_funded': isFunded,
      });
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
    prover: UniversalAddress,
    messageData: Hex,
    chainId: number | string,
    claimant: UniversalAddress,
  ): Promise<bigint> {
    // Denormalize addresses to TVM format
    const tvmProver = AddressNormalizer.denormalize(prover, ChainType.TVM);

    const span = this.otelService.startSpan('tvm.reader.fetchProverFee', {
      attributes: {
        'tvm.chain_id': chainId.toString(),
        'tvm.intent_id': intent.intentHash,
        'tvm.prover_address': intent.reward.prover,
        'tvm.operation': 'fetchProverFee',
        'tvm.claimant': claimant,
      },
    });

    try {
      const client = this.createTronWebClient(chainId);

      const encodeProof = encodePacked(
        ['uint64', 'bytes32', 'bytes32'],
        [intent.sourceChainId, intent.intentHash, claimant as Hex],
      );

      const contract = client.contract(messageBridgeProverAbi, tvmProver);
      const feeRaw = await contract.fetchFee(intent.sourceChainId, encodeProof, messageData).call();

      // Extract fee from the result
      const fee = BigInt(feeRaw);
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
