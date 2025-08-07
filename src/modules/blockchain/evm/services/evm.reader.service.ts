import { Injectable, Logger } from '@nestjs/common';

import { IMessageBridgeProverAbi, IntentSourceAbi } from '@eco-foundation/routes-ts';
import { Address, erc20Abi, Hex, isAddress } from 'viem';

import { BaseChainReader } from '@/common/abstractions/base-chain-reader.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';

import { EvmTransportService } from './evm-transport.service';

@Injectable()
export class EvmReaderService extends BaseChainReader {
  protected readonly logger = new Logger(EvmReaderService.name);

  constructor(
    private transportService: EvmTransportService,
    private evmConfigService: EvmConfigService,
  ) {
    super();
  }

  async getBalance(address: string, chainId: number): Promise<bigint> {
    const client = this.transportService.getPublicClient(chainId);
    return client.getBalance({ address: address as Address });
  }

  async getTokenBalance(tokenAddress: string, walletAddress: string, chainId: number): Promise<bigint> {
    const client = this.transportService.getPublicClient(chainId);
    const balance = await client.readContract({
      address: tokenAddress as Address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [walletAddress as Address],
    });

    return balance as bigint;
  }

  isAddressValid(address: string): boolean {
    return isAddress(address);
  }

  async isIntentFunded(intent: Intent, chainId: number): Promise<boolean> {
    try {
      const network = this.evmConfigService.getChain(chainId);
      if (!network || !network.intentSourceAddress) {
        this.logger.warn(`No IntentSource address configured for chain ${chainId}`);
        return false;
      }

      const client = this.transportService.getPublicClient(chainId);

      // The isIntentFunded function expects the full Intent struct
      const isFunded = await client.readContract({
        address: network.intentSourceAddress as Address,
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

      return isFunded as boolean;
    } catch (error) {
      this.logger.error(`Failed to check if intent ${intent.intentHash} is funded:`, error);
      throw new Error(`Failed to check intent funding status: ${error.message}`);
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

  async fetchProverFee(intent: Intent, messageData: Hex, chainId: number, claimant?: Address): Promise<bigint> {
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

      return fee as bigint;
    } catch (error) {
      this.logger.error(`Failed to fetch prover fee for intent ${intent.intentHash}:`, error);
      throw new Error(`Failed to fetch prover fee: ${error.message}`);
    }
  }
}
