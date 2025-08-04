import { Injectable } from '@nestjs/common';

import { Address, erc20Abi } from 'viem';

import { EvmTransportService } from './services/evm-transport.service';

@Injectable()
export class EvmReaderService {
  constructor(private transportService: EvmTransportService) {}

  async getBalance(chainId: number, address: Address): Promise<bigint> {
    const client = this.transportService.getPublicClient(chainId);
    return client.getBalance({ address });
  }

  async getTokenBalance(
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
