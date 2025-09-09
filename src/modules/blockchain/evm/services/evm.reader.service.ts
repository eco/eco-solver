import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { Address, decodeFunctionData, encodePacked, erc20Abi, Hex } from 'viem';

import { messageBridgeProverAbi } from '@/common/abis/message-bridge-prover.abi';
import { portalAbi } from '@/common/abis/portal.abi';
import { BaseChainReader } from '@/common/abstractions/base-chain-reader.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { toEVMIntent } from '@/common/utils/intent-converter';
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

  async getBalance(address: UniversalAddress, chainId: number): Promise<bigint> {
    const evmAddress = AddressNormalizer.denormalizeToEvm(address);
    const span = this.otelService.startSpan('evm.reader.getBalance', {
      attributes: {
        'evm.chain_id': chainId,
        'evm.address': address,
        'evm.operation': 'getBalance',
      },
    });

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
  }

  async getTokenBalance(
    tokenAddress: UniversalAddress,
    walletAddress: UniversalAddress,
    chainId: number,
  ): Promise<bigint> {
    const evmTokenAddress = AddressNormalizer.denormalizeToEvm(tokenAddress);
    const evmWalletAddress = AddressNormalizer.denormalizeToEvm(walletAddress);
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
  }

  async isIntentFunded(intent: Intent, chainId: number): Promise<boolean> {
    const span = this.otelService.startSpan('evm.reader.isIntentFunded', {
      attributes: {
        'evm.chain_id': chainId,
        'evm.intent_id': intent.intentHash,
        'evm.operation': 'isIntentFunded',
        'evm.source_chain': intent.sourceChainId?.toString(),
        'evm.destination_chain': intent.destination.toString(),
      },
    });

    try {
      // Get Portal address from config
      const portalAddress = this.evmConfigService.getEvmPortalAddress(chainId);

      span.setAttributes({
        'portal.address': portalAddress,
        'portal.method': 'isIntentFunded_contract',
      });

      const client = this.transportService.getPublicClient(chainId);

      // Use Portal contract's isIntentFunded function
      // Convert to EVM intent format for contract call
      const evmIntent = toEVMIntent(intent);
      const portalIntent = {
        destination: evmIntent.destination,
        route: evmIntent.route,
        reward: evmIntent.reward,
      };

      const isFunded = await client.readContract({
        address: portalAddress,
        abi: portalAbi,
        functionName: 'isIntentFunded',
        args: [portalIntent],
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
    claimant: UniversalAddress,
  ): Promise<bigint> {
    const evmProver = AddressNormalizer.denormalizeToEvm(prover);
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
      // Validate that sourceChainId is provided
      if (!intent.sourceChainId) {
        throw new Error(`Intent ${intent.intentHash} is missing required sourceChainId`);
      }

      const client = this.transportService.getPublicClient(chainId);

      const encodeProof = encodePacked(
        ['uint64', 'bytes32', 'bytes32'],
        [intent.sourceChainId, intent.intentHash, claimant as Hex],
      );

      // Call fetchFee on the prover contract
      const fee = await client.readContract({
        address: evmProver,
        abi: messageBridgeProverAbi,
        functionName: 'fetchFee',
        args: [
          intent.sourceChainId, // Source chain ID where the intent originates - no fallback
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
  }

  async validateTokenTransferCall(
    call: Intent['route']['calls'][number],
    chainId: number | string,
  ): Promise<boolean> {
    const span = this.otelService.startSpan('evm.reader.validateTokenTransferCall', {
      attributes: {
        'evm.operation': 'validateTokenTransferCall',
        'evm.target': call.target,
        'evm.chain_id': chainId.toString(),
        'evm.value': call.value.toString(),
      },
    });

    try {
      // First, validate that the target is a supported token address
      const isTokenSupported = this.evmConfigService.isTokenSupported(Number(chainId), call.target);

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
  }
}
