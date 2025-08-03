import { Injectable } from '@nestjs/common';

import { Address } from 'viem';

import { EvmConfigService } from '@/modules/config/services';

import { EvmTransportService } from './services/evm-transport.service';

@Injectable()
export class EvmReaderService {
  constructor(
    private transportService: EvmTransportService,
    private evmConfigService: EvmConfigService,
  ) {}

  private getClient(chainId: number) {
    return this.transportService.getPublicClient(chainId);
  }

  async getBalance(address: Address, chainId: number): Promise<bigint> {
    const client = this.getClient(chainId);
    return client.getBalance({ address });
  }

  async getTokenBalance(
    tokenAddress: Address,
    walletAddress: Address,
    chainId: number,
  ): Promise<bigint> {
    const abi = [
      {
        inputs: [{ name: 'account', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ];

    const client = this.getClient(chainId);
    const balance = await client.readContract({
      address: tokenAddress,
      abi,
      functionName: 'balanceOf',
      args: [walletAddress],
    });

    return balance as bigint;
  }

  async getBlockNumber(chainId: number): Promise<bigint> {
    const client = this.getClient(chainId);
    return client.getBlockNumber();
  }

  async readContract(
    chainId: number,
    params: {
      address: Address;
      abi: any;
      functionName: string;
      args?: any[];
    },
  ): Promise<any> {
    const client = this.getClient(chainId);
    return client.readContract({
      ...params,
      args: params.args || [],
    });
  }

  async multicall(chainId: number, params: { contracts: any[] }): Promise<any[]> {
    const client = this.getClient(chainId);
    const result = await client.multicall(params as any);
    return result as any[];
  }
}
