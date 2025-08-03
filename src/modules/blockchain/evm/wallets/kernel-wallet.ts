import { Address, encodeFunctionData, Hash, PublicClient, WalletClient } from 'viem';

import { BaseEvmWallet } from '@/common/abstractions/base-evm-wallet.abstract';
import {
  ReadContractParams,
  WriteContractParams,
  WriteContractsOptions,
} from '@/common/interfaces/evm-wallet.interface';

export interface KernelWalletConfig {
  kernelAddress: Address;
  moduleAddress?: Address;
}

export class KernelWallet extends BaseEvmWallet {
  private kernelAddress: Address;
  private moduleAddress?: Address;

  constructor(publicClient: PublicClient, walletClient: WalletClient, config: KernelWalletConfig) {
    super(publicClient, walletClient);
    this.kernelAddress = config.kernelAddress;
    this.moduleAddress = config.moduleAddress;
  }

  async getAddress(): Promise<Address> {
    return this.kernelAddress;
  }

  async readContract(params: ReadContractParams): Promise<any> {
    return this.publicClient.readContract({
      address: params.address,
      abi: params.abi,
      functionName: params.functionName,
      args: params.args,
    });
  }

  async readContracts(params: ReadContractParams[]): Promise<any[]> {
    const contracts = params.map((param) => ({
      address: param.address,
      abi: param.abi,
      functionName: param.functionName,
      args: param.args || [],
    }));

    const results = await (this.publicClient as any).multicall({ contracts });
    return results.map((result: any) => result.result);
  }

  async writeContract(params: WriteContractParams): Promise<Hash> {
    if (!this.walletClient.account) {
      throw new Error('Wallet client account not found');
    }

    const callData = encodeFunctionData({
      abi: params.abi,
      functionName: params.functionName,
      args: params.args,
    });

    const kernelExecuteAbi = [
      {
        name: 'execute',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
        outputs: [],
      },
    ];

    const { request } = await this.publicClient.simulateContract({
      address: this.kernelAddress,
      abi: kernelExecuteAbi,
      functionName: 'execute',
      args: [params.address, params.value || 0n, callData],
      value: params.value,
      account: this.walletClient.account,
    });

    return this.walletClient.writeContract(request);
  }

  async writeContracts(
    params: WriteContractParams[],
    options?: WriteContractsOptions,
  ): Promise<Hash[]> {
    if (!this.walletClient.account) {
      throw new Error('Wallet client account not found');
    }

    const executeBatchAbi = [
      {
        name: 'executeBatch',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
          { name: 'targets', type: 'address[]' },
          { name: 'values', type: 'uint256[]' },
          { name: 'datas', type: 'bytes[]' },
        ],
        outputs: [],
      },
    ];

    const targets: Address[] = [];
    const values: bigint[] = [];
    const datas: `0x${string}`[] = [];
    let totalValue = 0n;

    for (const param of params) {
      targets.push(param.address);
      values.push(param.value || 0n);
      datas.push(
        encodeFunctionData({
          abi: param.abi,
          functionName: param.functionName,
          args: param.args,
        }),
      );
      totalValue += param.value || 0n;
    }

    const { request } = await this.publicClient.simulateContract({
      address: this.kernelAddress,
      abi: executeBatchAbi,
      functionName: 'executeBatch',
      args: [targets, values, datas],
      value: totalValue,
      account: this.walletClient.account,
    });

    const hash = await this.walletClient.writeContract(request);
    return [hash];
  }
}
