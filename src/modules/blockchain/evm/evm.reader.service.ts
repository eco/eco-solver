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

  async getBlockNumber(): Promise<bigint> {
    const client = this.getClient();
    return client.getBlockNumber();
  }

  async readContract(params: {
    address: Address;
    abi: any;
    functionName: string;
    args?: any[];
  }): Promise<any> {
    const client = this.getClient();
    return client.readContract({
      ...params,
      args: params.args || [],
    });
  }

  async multicall(params: { contracts: any[] }): Promise<any[]> {
    const client = this.getClient();
    return client.multicall(params);
  }
}
