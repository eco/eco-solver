import { Address, Hash, PublicClient, WalletClient } from 'viem';

import { BaseEvmWallet } from '@/common/abstractions/base-evm-wallet.abstract';
import { Call, WriteContractsOptions } from '@/common/interfaces/evm-wallet.interface';

import { MULTICALL3_ABI } from '../../constants/multicall3.constants';

export class BasicWallet extends BaseEvmWallet {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly walletClient: WalletClient,
  ) {
    super();
  }

  async getAddress(): Promise<Address> {
    return this.walletClient.account.address;
  }

  async writeContract(call: Call): Promise<Hash> {
    return this.walletClient.sendTransaction(call as any);
  }

  async writeContracts(calls: Call[], options?: WriteContractsOptions): Promise<Hash[]> {
    const keepSender = options?.keepSender ?? false;

    if (keepSender) {
      // Execute transactions sequentially, keeping original sender
      const hashes: Hash[] = [];

      for (const call of calls) {
        const hash = await this.writeContract(call);
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
        throw new Error(`Multicall3 address not found for chain ${chainConfig.id}`);
      }

      const multicall3Address = chainConfig.contracts.multicall3.address;

      // Always use aggregate3Value for flexibility with value transfers
      const multicallCalls = calls.map((call) => ({
        allowFailure: false,
        target: call.to,
        value: call.value || 0n,
        callData: call.data,
      }));

      const totalValue = options?.value ?? multicallCalls.reduce((sum, p) => sum + (p.value || 0n), 0n);

      const { request } = await this.publicClient.simulateContract({
        address: multicall3Address,
        abi: MULTICALL3_ABI,
        functionName: 'aggregate3Value',
        args: [multicallCalls],
        value: totalValue,
        account: this.walletClient.account,
      });

      const hash = await this.walletClient.writeContract(request);
      if (!options?.skipWait) await this.publicClient.waitForTransactionReceipt({ hash });
      return [hash];
    }
  }
}
