import { Injectable, OnModuleInit } from '@nestjs/common';

import { Address } from 'viem';

import { IEvmWallet } from '@/common/interfaces/evm-wallet.interface';
import { IWalletFactory } from '@/modules/blockchain/evm/interfaces/wallet-factory.interface';
import { EvmConfigService } from '@/modules/config/services';
import { Logger } from '@/modules/logging';

import { BasicWalletFactory } from '../wallets/basic-wallet';
import { KernelWalletFactory } from '../wallets/kernel-wallet/kernel-wallet.factory';

export type WalletType = 'basic' | 'kernel';

@Injectable()
export class EvmWalletManager implements OnModuleInit {
  // Map of chainId -> walletType -> wallet
  private wallets: Map<number, Map<WalletType, IEvmWallet>> = new Map();
  private readonly walletFactories: IWalletFactory[];

  constructor(
    private readonly logger: Logger,
    private evmConfigService: EvmConfigService,
    private basicWalletFactory: BasicWalletFactory,
    private kernelWalletFactory: KernelWalletFactory,
  ) {
    this.logger.setContext(EvmWalletManager.name);
    this.walletFactories = [this.basicWalletFactory, this.kernelWalletFactory];
  }

  async onModuleInit() {
    this.logger.info('Initializing EVM wallets from configuration', {
      supportedChainIds: this.evmConfigService.supportedChainIds,
    });

    // Initialize wallets for each supported chain
    const initRequests = this.evmConfigService.supportedChainIds.map((chainId) =>
      this.initializeWalletsForChain(chainId),
    );

    await Promise.all(initRequests);
  }

  private async initializeWalletsForChain(chainId: number) {
    if (!this.wallets.has(chainId)) {
      this.wallets.set(chainId, new Map());
    }

    const chainWallets = this.wallets.get(chainId)!;

    for (const walletFactory of this.walletFactories) {
      try {
        const wallet = await walletFactory.createWallet(chainId);
        const walletAddress = await wallet.getAddress();
        chainWallets.set(walletFactory.name, wallet);
        this.logger.debug('Initialized wallet for chain', {
          walletType: walletFactory.name,
          chainId,
          walletAddress,
        });
      } catch (error) {
        this.logger.error('Failed to initialize wallet for chain', error, {
          walletType: walletFactory.name,
          chainId,
        });
        throw error;
      }
    }
  }

  getWalletTypes() {
    return this.walletFactories.map((factory) => factory.name);
  }

  getWallet(type: WalletType, chainId: number): IEvmWallet {
    const chainWallets = this.wallets.get(chainId);
    if (!chainWallets) {
      throw new Error(`No wallets configured for chain ${chainId}`);
    }

    const wallet = chainWallets.get(type);
    if (!wallet) {
      throw new Error(`Wallet type '${type}' not found for chain ${chainId}`);
    }

    return wallet;
  }

  async getWalletAddress(walletType: WalletType, chainId: number): Promise<Address> {
    const wallet = this.getWallet(walletType, chainId);
    return wallet.getAddress();
  }
}
