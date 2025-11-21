import { Injectable, Optional } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { Address, decodeFunctionData, encodeFunctionData, encodePacked, erc20Abi, Hex } from 'viem';

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
import { EvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { EvmTransportService } from './evm-transport.service';
import { EvmWalletManager } from './evm-wallet-manager.service';

@Injectable()
export class EvmReaderService extends BaseChainReader {
  constructor(
    private transportService: EvmTransportService,
    private evmConfigService: EvmConfigService,
    protected readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    @Optional() private evmWalletManager?: EvmWalletManager,
  ) {
    super();
    this.logger.setContext(EvmReaderService.name);
  }

  async getChainInfo(chainId: number): Promise<ChainInfo> {
    const wallets = [];

    if (this.evmWalletManager) {
      const walletTypes = this.evmWalletManager.getWalletTypes();

      for (const walletType of walletTypes) {
        try {
          const wallet = this.evmWalletManager.getWallet(walletType, chainId);
          const address = await wallet.getAddress();
          const metadata = await wallet.getMetadata?.();

          const walletInfo: any = {
            type: walletType,
            address,
          };

          if (metadata) {
            walletInfo.metadata = metadata;
          }

          wallets.push(walletInfo);
        } catch (error) {
          // Wallet type might not be configured for this chain
          this.logger.debug(`Wallet type ${walletType} not configured for EVM chain ${chainId}`);
        }
      }
    }

    const tokens = this.evmConfigService.getSupportedTokens(chainId);

    return {
      chainId,
      chainName: getChainName(chainId, ChainType.EVM),
      chainType: 'EVM',
      wallets,
      tokens: tokens.map((token) => ({
        address: AddressNormalizer.denormalize(token.address, ChainType.EVM),
        decimals: token.decimals,
        symbol: token.symbol,
      })),
    };
  }

  async getBalance(address: UniversalAddress, chainId: number): Promise<bigint> {
    const evmAddress = AddressNormalizer.denormalizeToEvm(address);
    return this.otelService.tracer.startActiveSpan(
      'evm.reader.getBalance',
      {
        attributes: {
          'evm.chain_id': chainId,
          'evm.address': address,
          'evm.operation': 'getBalance',
        },
      },
      async (span) => {
        try {
          const client = this.transportService.getPublicClient(chainId);
          const balance = await client.getBalance({ address: evmAddress });

          span.setAttribute('evm.balance', balance.toString());
          span.setStatus({ code: api.SpanStatusCode.OK });
          return balance;
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
    chainId: number,
  ): Promise<bigint> {
    const evmTokenAddress = AddressNormalizer.denormalizeToEvm(tokenAddress);
    const evmWalletAddress = AddressNormalizer.denormalizeToEvm(walletAddress);
    return this.otelService.tracer.startActiveSpan(
      'evm.reader.getTokenBalance',
      {
        attributes: {
          'evm.chain_id': chainId,
          'evm.token_address': tokenAddress,
          'evm.wallet_address': walletAddress,
          'evm.operation': 'getTokenBalance',
        },
      },
      async (span) => {
        try {
          const client = this.transportService.getPublicClient(chainId);
          const balance = await client.readContract({
            address: evmTokenAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [evmWalletAddress],
          });

          span.setAttribute('evm.token_balance', balance.toString());
          span.setStatus({ code: api.SpanStatusCode.OK });
          return balance as bigint;
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

  async isIntentFunded(intent: Intent, chainId: number): Promise<boolean> {
    return this.otelService.tracer.startActiveSpan(
      'evm.reader.isIntentFunded',
      {
        attributes: {
          'evm.chain_id': chainId,
          'evm.intent_hash': intent.intentHash,
          'evm.operation': 'isIntentFunded',
          'evm.source_chain': intent.sourceChainId?.toString(),
          'evm.destination_chain': intent.destination.toString(),
        },
      },
      async (span) => {
        try {
          // Get Portal address from config
          const portalAddress = this.evmConfigService.getEvmPortalAddress(chainId);

          span.setAttributes({
            'portal.address': portalAddress,
            'portal.method': 'isIntentFunded_contract',
          });

          const client = this.transportService.getPublicClient(chainId);

          const destinationChainType = ChainTypeDetector.detect(intent.destination);
          const routeEncoded = PortalEncoder.encode(intent.route, destinationChainType);

          const isFunded = await client.readContract({
            address: portalAddress,
            abi: portalAbi,
            functionName: 'isIntentFunded',
            args: [intent.destination, routeEncoded, toEvmReward(intent.reward)],
          });

          span.setAttributes({
            'portal.intent_funded': isFunded,
          });
          span.setStatus({ code: api.SpanStatusCode.OK });

          return Boolean(isFunded);
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
    prover: UniversalAddress,
    messageData: Hex,
    chainId: number,
    sourceDomainId: bigint,
    claimant: UniversalAddress,
  ): Promise<bigint> {
    const evmProver = AddressNormalizer.denormalizeToEvm(prover);
    return this.otelService.tracer.startActiveSpan(
      'evm.reader.fetchProverFee',
      {
        attributes: {
          'evm.chain_id': chainId,
          'evm.intent_hash': intent.intentHash,
          'evm.prover_address': intent.reward.prover,
          'evm.operation': 'fetchProverFee',
          'evm.has_claimant': !!claimant,
        },
      },
      async (span) => {
        try {
          const client = this.transportService.getPublicClient(chainId);

          // Encode proof with domain ID instead of chain ID
          const encodeProof = encodePacked(
            ['uint64', 'bytes32', 'bytes32'],
            [sourceDomainId, intent.intentHash, claimant as Hex],
          );

          // Call fetchFee on the prover contract
          const fee = await client.readContract({
            address: evmProver,
            abi: messageBridgeProverAbi,
            functionName: 'fetchFee',
            args: [
              sourceDomainId, // Source domain ID (prover-specific)
              encodeProof,
              messageData, // Message data parameter
            ],
          });

          span.setAttribute('evm.prover_fee', fee.toString());
          span.setStatus({ code: api.SpanStatusCode.OK });
          return fee as bigint;
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
    chainId: number | string,
  ): Promise<boolean> {
    return this.otelService.tracer.startActiveSpan(
      'evm.reader.validateTokenTransferCall',
      {
        attributes: {
          'evm.operation': 'validateTokenTransferCall',
          'evm.target': call.target,
          'evm.chain_id': chainId.toString(),
          'evm.value': call.value.toString(),
        },
      },
      async (span) => {
        try {
          // First, validate that the target is a supported token address
          const isTokenSupported = this.evmConfigService.isTokenSupported(
            Number(chainId),
            call.target,
          );

          span.setAttribute('evm.token_supported', isTokenSupported);

          if (!isTokenSupported) {
            throw new Error(
              `Target ${call.target} is not a supported token address on chain ${chainId}`,
            );
          }

          // Then, validate that the call data is a valid ERC20 transfer function
          const fn = decodeFunctionData({
            abi: erc20Abi,
            data: call.data,
          });

          span.setAttribute('evm.function_name', fn.functionName);

          // Check if it's a transfer function
          const isTransferCall = fn.functionName === 'transfer';

          span.setAttribute('evm.is_transfer_call', isTransferCall);

          if (!isTransferCall) {
            throw new Error(
              `Invalid ERC20 call: only transfer function is allowed, got ${fn.functionName}`,
            );
          }

          span.setStatus({ code: api.SpanStatusCode.OK });
          return true;
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw new Error(
            `Invalid ERC20 call for target ${call.target} on chain ${chainId}: ${getErrorMessage(error)}`,
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
    // Denormalize addresses to EVM format
    const evmRecipientAddress = AddressNormalizer.denormalizeToEvm(recipient);

    // Encode ERC20 transfer function
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [evmRecipientAddress, amount],
    });

    return {
      target: token,
      data,
      value: 0n,
    };
  }
}
