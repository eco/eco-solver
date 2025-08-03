import { Address, encodeFunctionData, Hash, PublicClient, WalletClient } from 'viem';

import { BaseEvmWallet } from '@/common/abstractions/base-evm-wallet.abstract';
import {
  ReadContractParams,
  WriteContractParams,
  WriteContractsOptions,
} from '@/common/interfaces/evm-wallet.interface';

import { MULTICALL3_ABI } from '../../constants/multicall3.constants';

export class BasicWallet extends BaseEvmWallet {
  protected publicClient: PublicClient;
  protected walletClient: WalletClient;

  constructor(publicClient: PublicClient, walletClient: WalletClient) {
    super();
    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }
  async getAddress(): Promise<Address> {
    if (!this.walletClient.account) {
      throw new Error('Wallet client account not found');
    }
    return this.walletClient.account.address;
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

    const { request } = await this.publicClient.simulateContract({
      address: params.address,
      abi: params.abi,
      functionName: params.functionName,
      args: params.args,
      value: params.value,
      account: this.walletClient.account,
    });

    return this.walletClient.writeContract(request);
  }

  async writeContracts(
    params: WriteContractParams[],
    options?: WriteContractsOptions,
  ): Promise<Hash[]> {
    const keepSender = options?.keepSender ?? false;

    if (keepSender) {
      // Execute transactions sequentially, keeping original sender
      const hashes: Hash[] = [];

      for (const param of params) {
        const hash = await this.writeContract(param);
        hashes.push(hash);
      }

      return hashes;
    } else {
      // Use multicall3 to batch transactions
      if (!this.walletClient.account) {
        throw new Error('Wallet client account not found');
      }

      // Get multicall3 address from chain configuration
      const _chain = await this.publicClient.getChainId();
      const chainConfig = this.publicClient.chain;

      if (!chainConfig?.contracts?.multicall3?.address) {
        throw new Error('Multicall3 contract address not found in chain configuration');
      }

      const multicall3Address = chainConfig.contracts.multicall3.address;

      // Always use aggregate3Value for flexibility with value transfers
      const calls = params.map((param) => ({
        target: param.address,
        allowFailure: false,
        value: param.value || 0n,
        callData: encodeFunctionData({
          abi: param.abi,
          functionName: param.functionName,
          args: param.args,
        }),
      }));

      const totalValue = params.reduce((sum, p) => sum + (p.value || 0n), 0n);

      const { request } = await this.publicClient.simulateContract({
        address: multicall3Address,
        abi: MULTICALL3_ABI,
        functionName: 'aggregate3Value',
        args: [calls],
        value: totalValue,
        account: this.walletClient.account,
      });

      const hash = await this.walletClient.writeContract(request);
      return [hash];
    }
  }
}
