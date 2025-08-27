import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { Address, encodePacked, erc20Abi, Hex, isAddress, pad } from 'viem';

import { PortalAbi } from '@/common/abis/portal.abi';
import { BaseChainReader } from '@/common/abstractions/base-chain-reader.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { EVMIntentType } from '@/modules/blockchain/evm/types/portal';
import { EvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { EvmTransportService } from './evm-transport.service';

const IMessageBridgeProverAbi = [
  {
    inputs: [],
    name: 'ArrayLengthMismatch',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'chainId',
        type: 'uint256',
      },
    ],
    name: 'ChainIdTooLarge',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'uint64',
        name: 'domainId',
        type: 'uint64',
      },
    ],
    name: 'DomainIdTooLarge',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'requiredFee',
        type: 'uint256',
      },
    ],
    name: 'InsufficientFee',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidProofMessage',
    type: 'error',
  },
  {
    inputs: [],
    name: 'MailboxCannotBeZeroAddress',
    type: 'error',
  },
  {
    inputs: [],
    name: 'RouterCannotBeZeroAddress',
    type: 'error',
  },
  {
    inputs: [],
    name: 'SenderCannotBeZeroAddress',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'sender',
        type: 'bytes32',
      },
    ],
    name: 'UnauthorizedIncomingProof',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'expected',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'actual',
        type: 'address',
      },
    ],
    name: 'UnauthorizedSender',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ZeroDomainID',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ZeroPortal',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
      },
    ],
    name: 'IntentAlreadyProven',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
      },
    ],
    name: 'IntentProofInvalidated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'claimant',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint64',
        name: 'destination',
        type: 'uint64',
      },
    ],
    name: 'IntentProven',
    type: 'event',
  },
  {
    inputs: [
      {
        internalType: 'uint64',
        name: 'destination',
        type: 'uint64',
      },
      {
        internalType: 'bytes32',
        name: 'routeHash',
        type: 'bytes32',
      },
      {
        internalType: 'bytes32',
        name: 'rewardHash',
        type: 'bytes32',
      },
    ],
    name: 'challengeIntentProof',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint64',
        name: 'domainID',
        type: 'uint64',
      },
      {
        internalType: 'bytes',
        name: 'encodedProofs',
        type: 'bytes',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
    ],
    name: 'fetchFee',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getProofType',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'sender',
        type: 'address',
      },
      {
        internalType: 'uint64',
        name: 'sourceChainDomainID',
        type: 'uint64',
      },
      {
        internalType: 'bytes',
        name: 'encodedProofs',
        type: 'bytes',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
    ],
    name: 'prove',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'intentHash',
        type: 'bytes32',
      },
    ],
    name: 'provenIntents',
    outputs: [
      {
        components: [
          {
            internalType: 'address',
            name: 'claimant',
            type: 'address',
          },
          {
            internalType: 'uint64',
            name: 'destination',
            type: 'uint64',
          },
        ],
        internalType: 'struct IProver.ProofData',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'version',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
] as const;

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
      const portalIntent: EVMIntentType = {
        destination: intent.destination,
        route: intent.route,
        reward: intent.reward,
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
    prover: Address,
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
      // Validate that sourceChainId is provided
      if (!intent.sourceChainId) {
        throw new Error(`Intent ${intent.intentHash} is missing required sourceChainId`);
      }

      const client = this.transportService.getPublicClient(chainId);

      const encodeProof = encodePacked(
        ['uint64', 'bytes32', 'bytes32'],
        [intent.sourceChainId, intent.intentHash, pad(claimant)],
      );

      // Call fetchFee on the prover contract
      const fee = await client.readContract({
        address: prover,
        abi: IMessageBridgeProverAbi,
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
      this.logger.error(`Failed to fetch prover fee for intent ${intent.intentHash}:`, error);
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw new Error(`Failed to fetch prover fee: ${error.message}`);
    } finally {
      span.end();
    }
  }
}
