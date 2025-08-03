import { Injectable, OnModuleInit } from '@nestjs/common';

import { Address } from 'viem';

import { IEvmWallet } from '@/common/interfaces/evm-wallet.interface';
import { EvmConfigService } from '@/modules/config/services';

import { BasicWalletFactory } from '../wallets/basic-wallet';
import { KernelWalletConfig, KernelWalletFactory } from '../wallets/kernel-wallet';

import { EvmTransportService } from './evm-transport.service';

export interface WalletConfig {
  id: string;
  type: 'basic' | 'kernel';
  kernelConfig?: KernelWalletConfig;
}

@Injectable()
export class EvmWalletManager implements OnModuleInit {
  // Map of chainId -> walletId -> wallet
  private wallets: Map<number, Map<string, IEvmWallet>> = new Map();
  private defaultWalletId: string | null = null;

  constructor(
    private evmConfigService: EvmConfigService,
    private basicWalletFactory: BasicWalletFactory,
    private kernelWalletFactory: KernelWalletFactory,
  ) {}

  onModuleInit() {
    this.evmConfigService.networks.forEach((network) => {});
  }

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

  async getWalletAddress(walletId: string, chainId: number): Promise<Address> {
    const wallet = this.getWallet(walletId, chainId);
    return wallet.getAddress();
  }

  private createWallet(
    config: WalletConfig,
    transportService: EvmTransportService,
    chainId: number,
  ): IEvmWallet {
    const publicClient = transportService.getPublicClient(chainId);
    const transport = transportService.getTransport(chainId);
    const chain = transportService.getViemChain(chainId);
    const privateKey = this.evmConfigService.privateKey as `0x${string}`;

    switch (config.type) {
      case 'basic':
        return this.basicWalletFactory.createWallet(publicClient, transport, chain, privateKey);
      case 'kernel':
        if (!config.kernelConfig) {
          throw new Error('Kernel wallet requires kernelConfig');
        }
        return this.kernelWalletFactory.createWallet(
          publicClient,
          transport,
          chain,
          privateKey,
          config.kernelConfig,
        );
      default:
        throw new Error(`Unknown wallet type: ${config.type}`);
    }
  }
}
