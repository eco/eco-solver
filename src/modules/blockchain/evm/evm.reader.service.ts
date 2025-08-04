import { Injectable, Logger } from '@nestjs/common';

import { Address, erc20Abi, isAddress } from 'viem';

import { BaseChainReader } from '@/common/abstractions/base-chain-reader.abstract';

import { EvmTransportService } from './services/evm-transport.service';

@Injectable()
export class EvmReaderService extends BaseChainReader {
  protected readonly logger = new Logger(EvmReaderService.name);
  private chainId: number;

  constructor(private transportService: EvmTransportService) {
    super();
  }

  setChainId(chainId: number): void {
    this.chainId = chainId;
  }

  async getBalance(address: string): Promise<bigint> {
    if (!this.chainId) {
      throw new Error('Chain ID not set. Call setChainId() first.');
    }
    const client = this.transportService.getPublicClient(this.chainId);
    return client.getBalance({ address: address as Address });
  }

  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<bigint> {
    if (!this.chainId) {
      throw new Error('Chain ID not set. Call setChainId() first.');
    }
    const client = this.transportService.getPublicClient(this.chainId);
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
}
