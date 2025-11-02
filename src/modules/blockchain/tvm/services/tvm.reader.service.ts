import { Injectable, Optional } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TronWeb } from 'tronweb';
import { decodeFunctionData, encodeFunctionData, encodePacked, erc20Abi, Hex } from 'viem';

import { messageBridgeProverAbi } from '@/common/abis/message-bridge-prover.abi';
import { portalAbi } from '@/common/abis/portal.abi';
import { BaseChainReader } from '@/common/abstractions/base-chain-reader.abstract';
import { ChainInfo } from '@/common/interfaces/chain-info.interface';
import { Call, Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { getChainName } from '@/common/utils/chain-name.utils';
import { ChainType, ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { toEvmReward } from '@/common/utils/intent-converter';
import { PortalEncoder } from '@/common/utils/portal-encoder';
import { TvmConfigService } from '@/modules/config/services';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { TvmClientUtils } from '../utils';

import { TvmWalletManagerService } from './tvm-wallet-manager.service';

@Injectable()
export class TvmReaderService extends BaseChainReader {
  protected readonly logger: PinoLogger;

  constructor(
    @InjectPinoLogger(TvmReaderService.name)
    logger: PinoLogger,
    private tvmConfigService: TvmConfigService,
    private readonly otelService: OpenTelemetryService,
    @Optional() private tvmWalletManager?: TvmWalletManagerService,
  ) {
    super();
    this.logger = logger;
  }

  async getChainInfo(chainId: number): Promise<ChainInfo> {
    const wallets = [];

    if (this.tvmWalletManager) {
      try {
        const wallet = this.tvmWalletManager.createWallet(chainId, 'basic');
        const address = await wallet.getAddress();
        wallets.push({
          type: 'basic',
          address: address.toString(),
        });
      } catch (error) {
        // Wallet might not be configured for this chain
        this.logger.debug(`Wallet not configured for TVM chain ${chainId}`);
      }
    }

    const tokens = this.tvmConfigService.getSupportedTokens(chainId);

    return {
      chainId,
      chainName: getChainName(chainId, ChainType.TVM),
      chainType: 'TVM',
      wallets,
      tokens: tokens.map((token) => ({
        address: AddressNormalizer.denormalize(token.address, ChainType.TVM),
        decimals: token.decimals,
        symbol: token.symbol,
      })),
    };
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
    const tracer = this.otelService.tracer;
    return tracer.startActiveSpan(
      'tvm.reader.getBalance',
      {
        attributes: {
          'tvm.chain_id': chainId.toString(),
          'tvm.address': tvmAddress,
          'tvm.operation': 'getBalance',
        },
      },
      async (span: api.Span) => {
        try {
          const client = this.createTronWebClient(chainId);

          const balance = await client.trx.getBalance(tvmAddress);
          const balanceBigInt = BigInt(balance);

          span.setAttribute('tvm.balance', balanceBigInt.toString());
          span.setStatus({ code: api.SpanStatusCode.OK });
          return balanceBigInt;
        } catch (error) {
          this.logger.error(
            `TVM getBalance error:`,
            error instanceof Error ? error.message : String(error),
            { operation: 'getBalance', chainId, address },
          );
          span.recordException(error as Error);
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
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
    chainId: number,
  ): Promise<bigint> {
    // Denormalize to TVM address format
    const tvmTokenAddress = AddressNormalizer.denormalize(tokenAddress, ChainType.TVM);
    const tvmWalletAddress = AddressNormalizer.denormalize(walletAddress, ChainType.TVM);
    const tracer = this.otelService.tracer;
    return tracer.startActiveSpan(
      'tvm.reader.getTokenBalance',
      {
        attributes: {
          'tvm.chain_id': chainId.toString(),
          'tvm.token_address': tvmTokenAddress,
          'tvm.wallet_address': tvmWalletAddress,
          'tvm.operation': 'getTokenBalance',
        },
      },
      async (span: api.Span) => {
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
        }
      },
    );
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
    const tracer = this.otelService.tracer;
    return tracer.startActiveSpan(
      'tvm.reader.getTokenAllowance',
      {
        attributes: {
          'tvm.chain_id': chainId.toString(),
          'tvm.token_address': tvmTokenAddress,
          'tvm.owner_address': tvmOwnerAddress,
          'tvm.spender_address': tvmSpenderAddress,
          'tvm.operation': 'getTokenBalance',
        },
      },
      async (span: api.Span) => {
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
        }
      },
    );
  }

  async isIntentFunded(intent: Intent, chainId: number): Promise<boolean> {
    const tracer = this.otelService.tracer;
    return tracer.startActiveSpan(
      'tvm.reader.isIntentFunded',
      {
        attributes: {
          'tvm.chain_id': chainId,
          'tvm.intent_hash': intent.intentHash,
          'tvm.operation': 'isIntentFunded',
          'tvm.source_chain': intent.sourceChainId?.toString(),
          'tvm.destination_chain': intent.destination.toString(),
        },
      },
      async (span: api.Span) => {
        try {
          const client = this.createTronWebClient(chainId);

          const portalAddrUA = this.tvmConfigService.getPortalAddress(chainId);
          const portalAddr = AddressNormalizer.denormalizeToTvm(portalAddrUA);
          span.setAttribute('tvm.chain_id', chainId);
          span.setAttribute('tvm.portal_address', portalAddr);

          const contract = client.contract(portalAbi, portalAddr);

          // Structure route data for TronWeb contract call
          const sourceChainType = ChainTypeDetector.detect(intent.sourceChainId);
          const encodedRoute = PortalEncoder.encode(intent.route, sourceChainType);

          // Structure route data for TronWeb contract call
          const evmReward = toEvmReward(intent.reward);
          const rewardData: Parameters<typeof contract.isIntentFunded>[2] = [
            evmReward.deadline,
            evmReward.creator,
            evmReward.prover,
            evmReward.nativeAmount,
            evmReward.tokens.map((t) => [t.token, t.amount]),
          ];

          const isFunded = await contract
            .isIntentFunded(intent.destination, encodedRoute, rewardData)
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
      },
    );
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

    const tracer = this.otelService.tracer;
    return tracer.startActiveSpan(
      'tvm.reader.fetchProverFee',
      {
        attributes: {
          'tvm.chain_id': chainId.toString(),
          'tvm.intent_hash': intent.intentHash,
          'tvm.prover_address': intent.reward.prover,
          'tvm.operation': 'fetchProverFee',
          'tvm.claimant': claimant,
        },
      },
      async (span: api.Span) => {
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
      },
    );
  }

  async validateTokenTransferCall(
    call: Intent['route']['calls'][number],
    chainId: number,
  ): Promise<boolean> {
    const tracer = this.otelService.tracer;
    return tracer.startActiveSpan(
      'tvm.reader.validateTokenTransferCall',
      {
        attributes: {
          'tvm.operation': 'validateTokenTransferCall',
          'tvm.target': call.target,
          'tvm.chain_id': chainId.toString(),
          'tvm.value': call.value.toString(),
        },
      },
      async (span: api.Span) => {
        try {
          // First, validate that the target is a supported token address
          const isTokenSupported = this.tvmConfigService.isTokenSupported(
            Number(chainId),
            call.target,
          );

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
      },
    );
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
