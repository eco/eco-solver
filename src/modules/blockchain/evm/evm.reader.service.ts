import { Injectable } from '@nestjs/common';

import { Address, createPublicClient, http, PublicClient } from 'viem';

import { EvmConfigService } from '@/modules/config/services';

@Injectable()
export class EvmReaderService {
  private client: PublicClient;

  constructor(private evmConfigService: EvmConfigService) {
    this.initializeClient();
  }

  private initializeClient() {
    const rpcUrl = this.evmConfigService.rpcUrl;

    this.client = createPublicClient({
      transport: http(rpcUrl),
    });
  }

  async getBalance(address: Address): Promise<bigint> {
    return this.client.getBalance({ address });
  }

  async getTokenBalance(tokenAddress: Address, walletAddress: Address): Promise<bigint> {
    const abi = [
      {
        inputs: [{ name: 'account', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ];

    const balance = await this.client.readContract({
      address: tokenAddress,
      abi,
      functionName: 'balanceOf',
      args: [walletAddress],
    });

    return balance as bigint;
  }

  async getBlockNumber(): Promise<bigint> {
    return this.client.getBlockNumber();
  }

  async readContract(params: {
    address: Address;
    abi: any;
    functionName: string;
    args?: any[];
  }): Promise<any> {
    return this.client.readContract({
      ...params,
      args: params.args || [],
    });
  }

  async multicall(params: { contracts: any[] }): Promise<any[]> {
    return this.client.multicall(params);
  }
}
