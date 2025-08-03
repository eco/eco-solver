import { Injectable } from '@nestjs/common';

import { Address, createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { IEvmWallet } from '@/common/interfaces/evm-wallet.interface';

import { BasicWallet } from '../wallets/basic-wallet';
import { KernelWallet, KernelWalletConfig } from '../wallets/kernel-wallet';

import { EvmTransportService } from './evm-transport.service';

export interface WalletConfig {
  id: string;
  type: 'basic' | 'kernel';
  privateKey: `0x${string}`;
  kernelConfig?: KernelWalletConfig;
}

@Injectable()
export class EvmWalletManager {
  // Map of chainId -> walletId -> wallet
  private wallets: Map<number, Map<string, IEvmWallet>> = new Map();
  private defaultWalletId: string | null = null;

  initialize(
    walletConfigs: WalletConfig[],
    transportService: EvmTransportService,
    chainId: number,
  ) {
    if (!this.wallets.has(chainId)) {
      this.wallets.set(chainId, new Map());
    }

    const chainWallets = this.wallets.get(chainId)!;

    for (const config of walletConfigs) {
      const wallet = this.createWallet(config, transportService, chainId);
      chainWallets.set(config.id, wallet);

      if (!this.defaultWalletId) {
        this.defaultWalletId = config.id;
      }
    }
  }

  private createWallet(
    config: WalletConfig,
    transportService: EvmTransportService,
    chainId: number,
  ): IEvmWallet {
    const publicClient = transportService.getPublicClient(chainId) as any;

    const account = privateKeyToAccount(config.privateKey);
    const transport = transportService.getTransport(chainId);
    const chain = transportService.getViemChain(chainId);

    const walletClient = createWalletClient({
      account,
      chain,
      transport,
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

  getWallet(walletId: string | undefined, chainId: number): IEvmWallet {
    const id = walletId || this.defaultWalletId;
    if (!id) {
      throw new Error('No wallet ID provided and no default wallet configured');
    }

    const chainWallets = this.wallets.get(chainId);
    if (!chainWallets) {
      throw new Error(`No wallets configured for chain ${chainId}`);
    }

    const wallet = chainWallets.get(id);
    if (!wallet) {
      throw new Error(`Wallet with ID ${id} not found for chain ${chainId}`);
    }

    return wallet;
  }

  async getWalletAddress(walletId: string | undefined, chainId: number): Promise<Address> {
    const wallet = this.getWallet(walletId, chainId);
    return wallet.getAddress();
  }
}
