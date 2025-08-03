import { Injectable } from '@nestjs/common';

import { Address, createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { IEvmWallet } from '@/common/interfaces/evm-wallet.interface';

import { BasicWallet } from '../wallets/basic-wallet';
import { KernelWallet, KernelWalletConfig } from '../wallets/kernel-wallet';

export interface WalletConfig {
  id: string;
  type: 'basic' | 'kernel';
  privateKey: `0x${string}`;
  kernelConfig?: KernelWalletConfig;
}

@Injectable()
export class EvmWalletManager {
  private wallets: Map<string, IEvmWallet> = new Map();
  private defaultWalletId: string | null = null;

  initialize(walletConfigs: WalletConfig[], rpcUrl: string, chain: any) {
    for (const config of walletConfigs) {
      const wallet = this.createWallet(config, rpcUrl, chain);
      this.wallets.set(config.id, wallet);

      if (!this.defaultWalletId) {
        this.defaultWalletId = config.id;
      }
    }
  }

  private createWallet(config: WalletConfig, rpcUrl: string, chain: any): IEvmWallet {
    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    }) as any;

    const account = privateKeyToAccount(config.privateKey);
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    });

    switch (config.type) {
      case 'basic':
        return new BasicWallet(publicClient, walletClient);
      case 'kernel':
        if (!config.kernelConfig) {
          throw new Error('Kernel config required for kernel wallet');
        }
        return new KernelWallet(publicClient, walletClient, config.kernelConfig);
      default:
        throw new Error(`Unknown wallet type: ${config.type}`);
    }
  }

  getWallet(walletId?: string): IEvmWallet {
    const id = walletId || this.defaultWalletId;
    if (!id) {
      throw new Error('No wallet ID provided and no default wallet configured');
    }

    const wallet = this.wallets.get(id);
    if (!wallet) {
      throw new Error(`Wallet with ID ${id} not found`);
    }

    return wallet;
  }

  async getWalletAddress(walletId?: string): Promise<Address> {
    const wallet = this.getWallet(walletId);
    return wallet.getAddress();
  }

  listWalletIds(): string[] {
    return Array.from(this.wallets.keys());
  }
}
