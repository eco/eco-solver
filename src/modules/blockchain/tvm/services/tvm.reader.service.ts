import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { TronWeb } from 'tronweb';
import { decodeFunctionData, encodeFunctionData, encodePacked, erc20Abi, Hex } from 'viem';

import { messageBridgeProverAbi } from '@/common/abis/message-bridge-prover.abi';
import { portalAbi } from '@/common/abis/portal.abi';
import { BaseChainReader } from '@/common/abstractions/base-chain-reader.abstract';
import { Call, Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType } from '@/common/utils/chain-type-detector';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { TvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { TvmClientUtils, TvmErrorHandler } from '../utils';

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
  async getBalance(address: UniversalAddress, chainId: number): Promise<bigint> {
    // Denormalize to TVM address format
    const tvmAddress = AddressNormalizer.denormalize(address, ChainType.TVM);
    const span = this.otelService.startSpan('tvm.reader.getBalance', {
      attributes: {
        'tvm.chain_id': chainId.toString(),
        'tvm.address': tvmAddress,
        'tvm.operation': 'getBalance',
      },
    });

    try {
      return await TvmErrorHandler.wrapAsync(
        async () => {
          const client = this.createTronWebClient(chainId);

          const balance = await client.trx.getBalance(tvmAddress);
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
    chainId: number,
  ): Promise<bigint> {
    // Denormalize to TVM address format
    const tvmTokenAddress = AddressNormalizer.denormalize(tokenAddress, ChainType.TVM);
    const tvmWalletAddress = AddressNormalizer.denormalize(walletAddress, ChainType.TVM);
    const span = this.otelService.startSpan('tvm.reader.getTokenBalance', {
      attributes: {
        'tvm.chain_id': chainId.toString(),
        'tvm.token_address': tvmTokenAddress,
        'tvm.wallet_address': tvmWalletAddress,
        'tvm.operation': 'getTokenBalance',
      },
    });

    try {
      const client = this.createTronWebClient(chainId);
      const contract = client.contract(erc20Abi, tvmTokenAddress);

      // Call TRC20 balanceOf function
      const balance = await contract.methods
        .balanceOf(tvmWalletAddress)
        .call({ from: tvmWalletAddress });

      // Extract balance from the result
      const balanceBigInt = BigInt(balance);

      span.setAttribute('tvm.token_balance', balanceBigInt.toString());
      span.setStatus({ code: api.SpanStatusCode.OK });
      return balanceBigInt;
    } catch (error) {
      span.recordException(toError(error));
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  async getTokenAllowance(
    tokenAddress: UniversalAddress,
    ownerAddress: UniversalAddress,
    spenderAddress: UniversalAddress,
    chainId: number,
  ): Promise<bigint> {
    // Denormalize to TVM address format
    const tvmTokenAddress = AddressNormalizer.denormalize(tokenAddress, ChainType.TVM);
    const tvmOwnerAddress = AddressNormalizer.denormalize(ownerAddress, ChainType.TVM);
    const tvmSpenderAddress = AddressNormalizer.denormalize(spenderAddress, ChainType.TVM);
    const span = this.otelService.startSpan('tvm.reader.getTokenAllowance', {
      attributes: {
        'tvm.chain_id': chainId.toString(),
        'tvm.token_address': tvmTokenAddress,
        'tvm.owner_address': tvmOwnerAddress,
        'tvm.spender_address': tvmSpenderAddress,
        'tvm.operation': 'getTokenBalance',
      },
    });

    try {
      const client = this.createTronWebClient(chainId);
      const contract = client.contract(erc20Abi, tvmTokenAddress);

      // Call TRC20 balanceOf function
      const allowance = await contract.methods
        .allowance(tvmOwnerAddress, tvmSpenderAddress)
        .call({ from: tvmOwnerAddress });

      // Extract balance from the result
      const allowanceBigInt = BigInt(allowance);

      span.setAttribute('tvm.token_allowance', allowanceBigInt.toString());
      span.setStatus({ code: api.SpanStatusCode.OK });
      return allowanceBigInt;
    } catch (error) {
      span.recordException(toError(error));
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
        'tvm.intent_hash': intent.intentHash,
        'tvm.operation': 'isIntentFunded',
        'tvm.source_chain': intent.sourceChainId?.toString(),
        'tvm.destination_chain': intent.destination.toString(),
      },
    });

    try {
      const client = this.createTronWebClient(chainId);

      const portalAddrUA = this.tvmConfigService.getPortalAddress(chainId);
      const portalAddr = AddressNormalizer.denormalizeToTvm(portalAddrUA);
      span.setAttribute('tvm.chain_id', chainId);
      span.setAttribute('tvm.portal_address', portalAddr);

      const contract = client.contract(portalAbi, portalAddr);

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
        AddressNormalizer.denormalizeToTvm(intent.reward.creator),
        AddressNormalizer.denormalizeToTvm(intent.reward.prover),
        intent.reward.nativeAmount,
        intent.reward.tokens.map((t) => [AddressNormalizer.denormalizeToTvm(t.token), t.amount]),
      ];

      const intentParam: Parameters<typeof contract.isIntentFunded>[0] = [
        intent.destination,
        routeData,
        rewardData,
      ];

      const isFunded = await contract
        .isIntentFunded(intentParam)
        .call({ from: AddressNormalizer.denormalizeToTvm(intent.reward.creator) });

      span.setAttributes({
        'portal.intent_funded': isFunded,
      });
      span.setStatus({ code: api.SpanStatusCode.OK });

      return isFunded;
    } catch (error) {
      this.logger.error(
        `Failed to check if intent ${intent.intentHash} is funded:`,
        toError(error),
      );
      span.recordException(toError(error));
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw new Error(`Failed to check intent funding status: ${getErrorMessage(error)}`);
    } finally {
      span.end();
    }
  }

  async fetchProverFee(
    intent: Intent,
    prover: UniversalAddress,
    messageData: Hex,
    chainId: number,
    claimant: UniversalAddress,
  ): Promise<bigint> {
    if (!intent.sourceChainId) {
      throw new Error('intent sourceChainId is missing');
    }

    // Denormalize addresses to TVM format
    const tvmProver = AddressNormalizer.denormalize(prover, ChainType.TVM);

    const span = this.otelService.startSpan('tvm.reader.fetchProverFee', {
      attributes: {
        'tvm.chain_id': chainId.toString(),
        'tvm.intent_hash': intent.intentHash,
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
      const feeRaw = await contract
        .fetchFee(intent.sourceChainId, encodeProof, messageData)
        .call({ from: tvmProver });

      // Extract fee from the result
      const fee = BigInt(feeRaw);
      const feeBigInt = BigInt('0x' + fee);

      span.setAttribute('tvm.prover_fee', feeBigInt.toString());
      span.setStatus({ code: api.SpanStatusCode.OK });
      return feeBigInt;
    } catch (error) {
      this.logger.error(
        `Failed to fetch prover fee for intent ${intent.intentHash}:`,
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
    const span = this.otelService.startSpan('tvm.reader.validateTokenTransferCall', {
      attributes: {
        'tvm.operation': 'validateTokenTransferCall',
        'tvm.target': call.target,
        'tvm.chain_id': chainId.toString(),
        'tvm.value': call.value.toString(),
      },
    });

    try {
      // First, validate that the target is a supported token address
      const isTokenSupported = this.tvmConfigService.isTokenSupported(Number(chainId), call.target);

      span.setAttribute('tvm.token_supported', isTokenSupported);

      if (!isTokenSupported) {
        throw new Error(
          `Target ${call.target} is not a supported token address on chain ${chainId}`,
        );
      }

      // Then, validate that the call data is a valid TRC20 transfer function
      // TVM (TRON) uses the same ABI encoding as EVM for TRC20 tokens
      const fn = decodeFunctionData({
        abi: erc20Abi,
        data: call.data,
      });

      span.setAttribute('tvm.function_name', fn.functionName);

      // Check if it's a transfer function
      const isTransferCall = fn.functionName === 'transfer';

      span.setAttribute('tvm.is_transfer_call', isTransferCall);

      if (!isTransferCall) {
        throw new Error(
          `Invalid TRC20 call: only transfer function is allowed, got ${fn.functionName}`,
        );
      }

      span.setStatus({ code: api.SpanStatusCode.OK });
      return true;
    } catch (error) {
      span.recordException(toError(error));
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw new Error(
        `Invalid TRC20 call for target ${call.target} on chain ${chainId}: ${getErrorMessage(error)}`,
      );
    } finally {
      span.end();
    }
  }

  buildTokenTransferCalldata(
    recipient: UniversalAddress,
    token: UniversalAddress,
    amount: bigint,
  ): Call {
    // Denormalize addresses to TVM format
    const evmRecipientAddress = AddressNormalizer.denormalizeToEvm(recipient);

    // TRC20 uses the same ABI encoding as ERC20
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [evmRecipientAddress, amount], // Cast to Address type
    });

    // Return the normalized token address as the target
    return {
      target: token,
      data,
      value: 0n,
    };
  }

  /**
   * Creates a TronWeb instance for the given chain
   * @param chainId - The chain ID to create client for
   * @returns TronWeb instance
   */
  private createTronWebClient(chainId: number): TronWeb {
    const network = this.tvmConfigService.getChain(chainId);
    return TvmClientUtils.createClient(network);
  }
}
