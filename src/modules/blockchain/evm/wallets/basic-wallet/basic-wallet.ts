import { Address, Hash, PublicClient, WalletClient } from 'viem';

import { multicall3Abi } from '@/common/abis/multicall3.constants';
import { BaseEvmWallet } from '@/common/abstractions/base-evm-wallet.abstract';
import { EvmCall, WriteContractsOptions } from '@/common/interfaces/evm-wallet.interface';

export class BasicWallet extends BaseEvmWallet {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly walletClient: WalletClient,
  ) {
    super();
  }

  async getAddress(): Promise<Address> {
    return this.walletClient.account!.address;
  }

  async writeContract(call: EvmCall): Promise<Hash> {
    return this.walletClient.sendTransaction(call as any);
  }

  async writeContracts(calls: EvmCall[], options?: WriteContractsOptions): Promise<Hash[]> {
    const keepSender = options?.keepSender ?? false;

    if (keepSender || calls.length === 1) {
      // Execute transactions sequentially, keeping original sender
      const hashes: Hash[] = [];

      for (const call of calls) {
        const hash = await this.walletClient.sendTransaction({
          ...call,
          gas: options?.gas,
        } as any);
        if (!options?.skipWait) await this.publicClient.waitForTransactionReceipt({ hash });
        hashes.push(hash);
      }

      return hashes;
    } else {
      // Use multicall3 to batch transactions
      if (calls.length === 0) {
        return [];
      }

      if (!this.walletClient.account) {
        throw new Error('Wallet client account not found');
      }

      // Get multicall3 address from chain configuration
      const chainConfig = this.publicClient.chain;

      if (!chainConfig?.contracts?.multicall3?.address) {
        throw new Error(`Multicall3 address not found for chain ${chainConfig?.id}`);
      }

      const multicall3Address = chainConfig.contracts.multicall3.address;

      // Always use aggregate3Value for flexibility with value transfers
      const multicallCalls = calls.map((call) => ({
        allowFailure: false,
        target: call.to,
        value: call.value || 0n,
        callData: call.data || '0x',
      }));

      const totalValue =
        options?.value ?? multicallCalls.reduce((sum, p) => sum + (p.value || 0n), 0n);

      const { request } = await this.publicClient.simulateContract({
        address: multicall3Address,
        abi: multicall3Abi,
        functionName: 'aggregate3Value',
        args: [multicallCalls],
        value: totalValue,
        gas: options?.gas,
        account: this.walletClient.account,
      });

      const hash = await this.walletClient.writeContract({
        ...request,
        gas: options?.gas,
      } as any);
      if (!options?.skipWait) await this.publicClient.waitForTransactionReceipt({ hash });
      return [hash];
    }
  }
}
